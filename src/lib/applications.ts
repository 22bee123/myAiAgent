// ===========================================================================
// lib/applications.ts
// ---------------------------------------------------------------------------
// Job-application tracker. Scans the user's inbox for emails that look like
// application updates (application submitted, recruiter viewed your profile,
// interview invited, offer extended, role closed/expired) and consolidates
// them into a single per-application status board.
//
// The detection is keyword + sender based — no LLM call needed, so it's
// fast and free. For more accuracy you could later add an LLM pass to
// classify ambiguous emails, but the keyword approach catches the vast
// majority of automated recruiter emails correctly.
//
// Pipeline:
//   fetchInbox(limit=50)  →  filter to application-related  →  classify
//                          →  group by (company, role)      →  pick latest
//                          →  return tracker[]
//
// Each tracker entry represents ONE application (not one email). The
// `latestEmail` field is the most recent email for that application, and
// `history` is the full list of related emails in reverse chronological
// order.
// ===========================================================================

import { fetchInbox, type EmailMessage } from "@/lib/email";

export type ApplicationStatus =
  | "applied" // user submitted an application
  | "viewed" // recruiter viewed the application
  | "interview" // interview invited / scheduled
  | "offer" // offer extended
  | "closed" // role closed / expired / rejected
  | "updated"; // generic update (fallback)

export interface Application {
  id: string; // stable id derived from company + role
  company: string;
  role: string;
  status: ApplicationStatus;
  lastUpdate: string; // ISO date of most recent email
  daysSinceUpdate: number;
  latestEmail: EmailMessage;
  history: EmailMessage[];
}

export interface TrackerResult {
  connected: boolean; // true = real mailbox, false = demo
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  applications: Application[];
}

// ---- Senders we treat as application-related ------------------------------
// These are the recruiting platforms that send automated status emails.
// Adding a new platform is just adding its domain here.
const APPLICATION_SENDERS = [
  "indeed.com",
  "jobstreet.com",
  "ziprecruiter.com",
  "linkedin.com",
  "glassdoor.com",
  "jooble.org",
  "talent.com",
  "monster.com",
  "hired.com",
  "wellfound.com",
  "angel.co",
  "lever.co",
  "greenhouse.io",
  "workday.com",
  "smartrecruiters.com",
  "teamtailor.com",
  "recruitee.com",
  "ashbyhq.com",
  "noreply@accounts.google.com", // we filter this out below — security alerts
];

// Filter out emails from these senders even if they match the domain list
// above (e.g. Google security alerts that come from no-reply@accounts.google.com
// aren't application-related).
const SENDER_BLOCKLIST = ["no-reply@accounts.google.com", "noreply@accounts.google.com"];

function isApplicationEmail(msg: EmailMessage): boolean {
  const fromLower = msg.from.toLowerCase();
  if (SENDER_BLOCKLIST.some((s) => fromLower.includes(s))) return false;
  return APPLICATION_SENDERS.some((s) => fromLower.includes(s));
}

// ---- Status classification ------------------------------------------------
// Keyword-based. Order matters — we check the most specific statuses first
// (interview, offer, closed) before falling back to viewed / applied.
//
// The keywords are matched against subject + snippet (lowercased). Subject
// alone is usually enough for automated recruiter emails, but including the
// snippet catches cases where the status word is in the body.
function classifyStatus(msg: EmailMessage): ApplicationStatus {
  const text = `${msg.subject} ${msg.snippet}`.toLowerCase();

  // Closed / expired / rejected — check first so a "closed" email doesn't
  // get misclassified as "viewed" or "applied" based on other keywords.
  if (
    /\b(closed|expired|no longer|rejection|not (?:moving|selected|moving forward)|withdrawn|position has been filled|position is no longer)\b/.test(
      text
    )
  ) {
    return "closed";
  }

  // Interview
  if (
    /\b(interview|schedule|book a (?:call|time)|video call|technical screen|onsite|phone screen|hiring manager call)\b/.test(
      text
    )
  ) {
    return "interview";
  }

  // Offer
  if (/\b(offer|job offer|employment offer|congratulations|welcome to (?:the )?team)\b/.test(text)) {
    return "offer";
  }

  // Viewed — recruiter looked at your application
  if (/\b(viewed your (?:application|profile)|reviewed your application|saw your (?:application|profile))\b/.test(text)) {
    return "viewed";
  }

  // Applied — submission confirmation
  if (/\b(applied|application (?:received|submitted|confirmed)|we received your application|thank you for applying|application for)\b/.test(text)) {
    return "applied";
  }

  // Job alert / recommendation — these are NEW jobs, not applications.
  // We treat them as "applied" with company="Job Alert" so they show up but
  // don't pollute the tracker with non-applications. Actually, better to
  // skip them entirely — they're not applications.
  if (/\b(job alert|new jobs?|recommended jobs?|jobs? for you|matches? for you|open position|open role)\b/.test(text)) {
    // Return a sentinel — caller will filter these out
    return "updated" as ApplicationStatus; // we'll skip "updated" entries later
  }

  // Default — some kind of application update we couldn't classify
  return "updated";
}

// ---- Extract company + role from subject line ----------------------------
// Recruiter emails usually follow patterns like:
//   "Your application for AI Engineer at Stratpoint"
//   "Application viewed: AI/Automation Specialist - Web Development Company"
//   "Hi Paul, the GenAI Engineer job with SPX PHILIPPINES has closed"
//   "Paul, micro1 AI has an open position"
//
// We try to extract company + role. If we can't, we fall back to using
// the sender's name as the company and the subject as the role.
function extractCompanyAndRole(
  msg: EmailMessage
): { company: string; role: string } {
  const subject = msg.subject || "";
  const fromName = msg.from.split("<")[0].trim() || "Unknown";

  // Pattern 1: "... for <ROLE> at <COMPANY>"
  let m = subject.match(/(?:application for|applied for|your application for)\s+(.+?)\s+at\s+([A-Z][\w\s&.,'-]+?)(?:\s*[,\-—]|$)/i);
  if (m) return { role: m[1].trim(), company: m[2].trim() };

  // Pattern 2: "... with <COMPANY> ..."
  m = subject.match(/(?:job with|role with|position with|application with)\s+([A-Z][\w\s&.,'-]+?)(?:\s+has|\s*[,\-—]|\s*$)/i);
  if (m) {
    const company = m[1].trim();
    // Try to find role elsewhere in subject
    const roleMatch = subject.match(/(?:the)\s+(.+?)\s+(?:job|role|position)/i);
    return { company, role: roleMatch ? roleMatch[1].trim() : "Position" };
  }

  // Pattern 3: "<COMPANY> has an open position" / "<COMPANY> viewed your application"
  m = subject.match(/^([A-Z][\w\s&.,'-]+?)\s+(?:has|viewed|reviewed|is hiring)/i);
  if (m) return { company: m[1].trim(), role: extractRoleFromSubject(subject) };

  // Pattern 4: "viewed your application for <ROLE> - <COMPANY>"
  m = subject.match(/application for\s+(.+?)\s*-\s*([A-Z][\w\s&.,'-]+?)(?:\s*$)/i);
  if (m) return { role: m[1].trim(), company: m[2].trim() };

  // Fallback: use sender name as company, subject as role
  return {
    company: fromName.replace(/\s+(Inc|LLC|Ltd|Corp|Co)\.?$/i, "").trim(),
    role: subject.slice(0, 60).trim() || "Position",
  };
}

function extractRoleFromSubject(subject: string): string {
  const m = subject.match(/(?:open (?:position|role|job))\s*:?\s*(.*)/i);
  if (m) return m[1].trim();
  return "Position";
}

// ---- Build stable id from company + role ---------------------------------
function makeId(company: string, role: string): string {
  const normalized = `${company}::${role}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.slice(0, 80);
}

// ---- Main entry point: build the tracker ---------------------------------
export async function buildTracker(limit = 50): Promise<TrackerResult> {
  // Fetch more emails than we'll likely need (filter will narrow down).
  const inbox = await fetchInbox(limit);

  if (!inbox.connected) {
    return mockTracker();
  }

  // 1. Filter to application-related emails only
  const appEmails = inbox.messages.filter(isApplicationEmail);

  // 2. Classify each by status, skip "updated" (job alerts, not applications)
  const classified = appEmails
    .map((msg) => ({ msg, status: classifyStatus(msg) }))
    .filter((c) => c.status !== "updated"); // skip job alerts

  // 3. Group by (company, role) → one Application per group
  const groups = new Map<string, Application>();
  for (const { msg, status } of classified) {
    const { company, role } = extractCompanyAndRole(msg);
    const id = makeId(company, role);

    const existing = groups.get(id);
    if (existing) {
      existing.history.push(msg);
      // Update status if this email is more recent OR has a higher-priority status
      const msgDate = new Date(msg.date).getTime();
      const existingDate = new Date(existing.lastUpdate).getTime();
      if (msgDate > existingDate) {
        existing.lastUpdate = msg.date;
        existing.latestEmail = msg;
        // Status priority: closed > offer > interview > viewed > applied
        // (newer wins on ties, but closed always overrides because it's terminal)
        if (
          status === "closed" ||
          statusPriority(status) >= statusPriority(existing.status)
        ) {
          existing.status = status;
        }
      }
    } else {
      groups.set(id, {
        id,
        company,
        role,
        status,
        lastUpdate: msg.date,
        daysSinceUpdate: daysSince(msg.date),
        latestEmail: msg,
        history: [msg],
      });
    }
  }

  // 4. Sort by lastUpdate desc (most recent activity first)
  const applications = Array.from(groups.values()).sort(
    (a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime()
  );

  // 5. Build status counts
  const byStatus: Record<ApplicationStatus, number> = {
    applied: 0,
    viewed: 0,
    interview: 0,
    offer: 0,
    closed: 0,
    updated: 0,
  };
  for (const a of applications) byStatus[a.status]++;

  return {
    connected: true,
    total: applications.length,
    byStatus,
    applications,
  };
}

function statusPriority(s: ApplicationStatus): number {
  switch (s) {
    case "applied": return 1;
    case "viewed": return 2;
    case "interview": return 3;
    case "offer": return 4;
    case "closed": return 5; // terminal — always wins
    case "updated": return 0;
  }
}

function daysSince(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

// ---- Demo mode mock tracker ----------------------------------------------
// Used when email isn't configured. Mirrors what real tracker output looks
// like so the UI is fully functional in demo mode.
function mockTracker(): TrackerResult {
  const now = Date.now();
  const day = 1000 * 60 * 60 * 24;
  const mockEmail = (
    uid: number,
    from: string,
    subject: string,
    snippet: string,
    daysAgo: number
  ): EmailMessage => ({
    uid,
    from,
    to: "you",
    subject,
    date: new Date(now - daysAgo * day).toISOString(),
    snippet,
    unread: false,
  });

  const apps: Application[] = [
    {
      id: "stratpoint-ai-engineer",
      company: "Stratpoint Technologies",
      role: "Senior AI Engineer",
      status: "interview",
      lastUpdate: new Date(now - 1 * day).toISOString(),
      daysSinceUpdate: 1,
      latestEmail: mockEmail(
        100,
        "Stratpoint HR <hr@stratpoint.com>",
        "Interview invitation: Senior AI Engineer",
        "Hi Paul, we'd like to schedule a technical interview for the Senior AI Engineer role. Are you available next Tuesday at 2pm?",
        1
      ),
      history: [],
    },
    {
      id: "micro1-software-engineer",
      company: "micro1 AI",
      role: "Software Engineer",
      status: "viewed",
      lastUpdate: new Date(now - 2 * day).toISOString(),
      daysSinceUpdate: 2,
      latestEmail: mockEmail(
        99,
        "ZipRecruiter <alerts@ziprecruiter.com>",
        "Paul, micro1 AI viewed your application for Software Engineer",
        "Good news — a recruiter at micro1 AI viewed your application for the Software Engineer role in Foster City, CA.",
        2
      ),
      history: [],
    },
    {
      id: "spx-genai-engineer",
      company: "SPX PHILIPPINES INC.",
      role: "GenAI Process Automation Engineer",
      status: "closed",
      lastUpdate: new Date(now - 3 * day).toISOString(),
      daysSinceUpdate: 3,
      latestEmail: mockEmail(
        98,
        "Jobstreet Applications <noreply@e.jobstreet.com>",
        "Hi Paul kian, the GenAI Process Automation Engineer job with SPX PHILIPPINES INC. has closed",
        "The GenAI Process Automation Engineer job you applied for at SPX PHILIPPINES INC. has expired and is no longer taking applications.",
        3
      ),
      history: [],
    },
    {
      id: "purple-cow-cpp-engineer",
      company: "Purple Cow Philippines",
      role: "C++ Software Engineer",
      status: "applied",
      lastUpdate: new Date(now - 5 * day).toISOString(),
      daysSinceUpdate: 5,
      latestEmail: mockEmail(
        97,
        "Indeed <match@indeed.com>",
        "Application submitted: C++ Software Engineer at Purple Cow Philippines",
        "Your application for C++ Software Engineer at Purple Cow Philippines has been submitted successfully.",
        5
      ),
      history: [],
    },
  ];

  return {
    connected: false,
    total: apps.length,
    byStatus: {
      applied: 1,
      viewed: 1,
      interview: 1,
      offer: 0,
      closed: 1,
      updated: 0,
    },
    applications: apps,
  };
}
