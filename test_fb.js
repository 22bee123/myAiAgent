const token = "EAAWsg6u57Q0BSJ9gRkL6eqkyr8TXrOv1qVKAJk6hZAp2eN5j3GWD94NGqJHmwaGyeJ7LQ1vHAlj3Lz3T8dZCdmYxigFKVZBriEah2oiNTlufqEwZBsZA3ZBNxZCb6Le4MZCIXGOanLqjD0BUZAyd8FCS0ZBaZAgx6EETbfqNNvrM0BgxSAmovcZB8ckXWQdhBgkzl93ISjcuKQZDZD";
const pageId = "1597056405335309";

async function test() {
  const url1 = `https://graph.facebook.com/v21.0/me?access_token=${token}`;
  const res1 = await fetch(url1);
  const json1 = await res1.json();
  console.log("ME:", json1);

  const url2 = `https://graph.facebook.com/v21.0/${pageId}/photos?access_token=${token}`;
  const res2 = await fetch(url2, { method: "POST", body: JSON.stringify({ url: "https://via.placeholder.com/150", published: false }) });
  const json2 = await res2.json();
  console.log("PHOTOS:", json2);
}

test();
