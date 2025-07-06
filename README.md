# SusRadar 🚨

A Chrome extension that helps you spot suspicious companies and find better alternatives while browsing the web.

## Features

- **Automatic Detection**: Shows a dropdown alert when you visit tracked suspicious sites
- **Sus Rating System**: 1-5 scale rating with visual indicator (green = safe, red = sus AF)
- **Alternative Suggestions**: Provides links to better companies/alternatives
- **User Contributions**: Add your own sites and companies to track
- **Playful Design**: Fun, goofy interface with gradients and animations

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the SusRadar folder
5. The extension will appear in your toolbar

## Usage

### Automatic Alerts
Visit any tracked suspicious site (like Facebook, Twitter/X, or TikTok) and watch for the dropdown in the top-right corner.

### Manual Management
Click the SusRadar extension icon to:
- ➕ Add current site to radar
- ✏️ Edit existing entries
- 🗑️ Remove sites from radar
- 📋 View all tracked entries

### Adding New Sites
1. Click the extension icon
2. Click ➕ to add current site
3. Fill in company details:
   - Company name
   - Sus rating (1-5)
   - Description (why it's suspicious)
   - Alternative links
   - Additional URLs for the same company

## Pre-loaded Data

The extension comes with data for these companies:
- **Meta (Facebook)** - Rating: 4/5
- **X (Twitter)** - Rating: 4/5  
- **ByteDance (TikTok)** - Rating: 5/5

## Architecture

Built with a clean, extensible architecture:

```
src/
├── core/interfaces.js       # Base classes
├── storage/                 # Data storage providers
├── matching/                # URL matching strategies
└── data/                   # Initial dataset
```

This design makes it easy to:
- Add server backend later
- Implement more sophisticated URL matching
- Scale to thousands of entries

## Technical Details

- **Manifest V3** Chrome extension
- **Local storage** using Chrome's storage API
- **Company-centric data model** (multiple URLs → one company)
- **Modular architecture** for future extensibility

## Contributing

Feel free to:
- Add more suspicious companies
- Improve the UI/UX
- Add new features
- Report bugs

## License

Open source - use it, modify it, share it!

---

*Built with ❤️ for a more transparent web*