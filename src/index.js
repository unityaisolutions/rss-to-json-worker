import { XMLParser } from "fast-xml-parser";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only accept GET requests
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { 
        status: 405, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }

    // Extract the target RSS URL from the query string
    const url = new URL(request.url);
    const feedUrl = url.searchParams.get("url");

    if (!feedUrl) {
      return new Response(JSON.stringify({ error: "Missing 'url' query parameter. Example: ?url=https://example.com/rss" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    try {
      // Fetch the RSS/Atom feed
      const response = await fetch(feedUrl, {
        headers: {
          "User-Agent": "Cloudflare-Worker-RSS-Parser/1.0",
          "Accept": "application/rss+xml, application/xml, application/atom+xml, text/xml"
        }
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch target feed: ${response.status} ${response.statusText}` }), {
          status: response.status,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      const xmlData = await response.text();

      // Parse the XML
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
      });
      const jsonObj = parser.parse(xmlData);

      // Clean and standardize the output
      let metadata = {};
      let items = [];

      // Handle RSS 2.0 format
      if (jsonObj.rss && jsonObj.rss.channel) {
        const channel = jsonObj.rss.channel;
        metadata = {
          title: channel.title,
          description: channel.description,
          link: channel.link
        };
        
        if (channel.item) {
          const rawItems = Array.isArray(channel.item) ? channel.item : [channel.item];
          items = rawItems.map(item => ({
            title: item.title,
            link: item.link,
            description: item.description,
            pubDate: item.pubDate,
            guid: item.guid?.["#text"] || item.guid
          }));
        }
      } 
      // Handle Atom format
      else if (jsonObj.feed) {
        const feed = jsonObj.feed;
        metadata = {
          title: feed.title,
          description: feed.subtitle,
          link: feed.link?.["@_href"] || feed.link
        };

        if (feed.entry) {
          const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
          items = entries.map(entry => ({
            title: entry.title,
            link: entry.link?.["@_href"] || entry.link,
            description: entry.summary || entry.content,
            pubDate: entry.updated || entry.published,
            guid: entry.id
          }));
        }
      } 
      // Fallback if the format is weird
      else {
        items = jsonObj;
      }

      // Return the clean JSON
      return new Response(JSON.stringify({ success: true, metadata, items }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: "Failed to parse the feed", details: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};