import React from "react";

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12 font-sans text-slate-800 dark:text-slate-200">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Effective Date: July 24, 2026</p>

      <section className="space-y-6 text-base leading-relaxed">
        <div>
          <h2 className="text-xl font-semibold mb-2">1. Overview</h2>
          <p>
            MyAiAgent (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy describes how our Facebook Messenger AI application collects, uses, and safeguards information when you communicate with our Facebook Page.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">2. Information We Collect</h2>
          <p>
            When you send a message to our Facebook Page, we process:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600 dark:text-slate-300">
            <li>Your Page-Scoped User ID (PSID) assigned by Meta.</li>
            <li>The content of messages sent to our Facebook Page.</li>
          </ul>
          <p className="mt-2">
            We do <strong>not</strong> collect your real personal Facebook account credentials, financial data, or external profile data without consent.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">3. How We Use Information</h2>
          <p>
            Information collected is strictly used to:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600 dark:text-slate-300">
            <li>Process and generate AI automated customer support responses to your inquiries.</li>
            <li>Maintain customer service conversation quality.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">4. Data Protection & Sharing</h2>
          <p>
            We do not sell, rent, or trade your personal data with third-party advertisers. Message content is securely processed via encrypted channels for generating automated customer support replies.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">5. Data Retention & Deletion</h2>
          <p>
            You may request deletion of your conversation data at any time by messaging our Facebook Page with &quot;DELETE MY DATA&quot; or contacting our team.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">6. Contact Us</h2>
          <p>
            If you have questions regarding this Privacy Policy, please reach out through our Facebook Page or support contact.
          </p>
        </div>
      </section>
    </main>
  );
}
