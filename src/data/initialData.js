const INITIAL_DATA = {
  url_mappings: {
    "facebook.com": "meta_corp",
    "www.facebook.com": "meta_corp",
    "instagram.com": "meta_corp",
    "www.instagram.com": "meta_corp",
    "whatsapp.com": "meta_corp",
    "www.whatsapp.com": "meta_corp",
    "twitter.com": "x_corp",
    "www.twitter.com": "x_corp",
    "x.com": "x_corp",
    "www.x.com": "x_corp",
    "tiktok.com": "bytedance",
    "www.tiktok.com": "bytedance"
  },
  company_data: {
    "meta_corp": {
      company_name: "Meta (Facebook)",
      sus_rating: 4,
      description: "🕵️ Known for aggressive data collection, privacy violations, and spreading misinformation. Has been fined billions for privacy breaches and continues to track users across the web.",
      alternative_links: [
        "https://signal.org",
        "https://mastodon.social",
        "https://diasporafoundation.org",
        "https://element.io"
      ],
      date_added: "2024-01-01T00:00:00.000Z",
      user_added: false
    },
    "x_corp": {
      company_name: "X (formerly Twitter)",
      sus_rating: 4,
      description: "🎭 Platform has become increasingly problematic with content moderation issues, bot accounts, and questionable leadership decisions affecting user safety and data privacy.",
      alternative_links: [
        "https://mastodon.social",
        "https://bsky.app",
        "https://threads.net",
        "https://counter.social"
      ],
      date_added: "2024-01-01T00:00:00.000Z",
      user_added: false
    },
    "bytedance": {
      company_name: "ByteDance (TikTok)",
      sus_rating: 5,
      description: "🚨 Chinese-owned app with serious data privacy concerns. Collects massive amounts of user data and has potential ties to Chinese government surveillance programs.",
      alternative_links: [
        "https://youtube.com/shorts",
        "https://instagram.com/reels",
        "https://triller.co",
        "https://byte.co"
      ],
      date_added: "2024-01-01T00:00:00.000Z",
      user_added: false
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = INITIAL_DATA;
}