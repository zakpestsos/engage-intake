# Google Maps Places API Setup

To enable address autocomplete in your intake form, you need to set up a Google Maps API key.

## Step 1: Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **API key**
5. Copy the API key

## Step 2: Enable Required APIs

1. Go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Maps JavaScript API**
   - **Places API**

## Step 3: Restrict Your API Key (IMPORTANT - DO THIS NOW)

1. Go back to Google Cloud Console → **APIs & Services** → **Credentials**
2. Click on your Maps API key: `AIzaSyC9AzPi4MPa7IJr0wxfFsSSoSCMtYeSrVM`
3. Under **Application restrictions**:
   - Select **HTTP referrers (web sites)**
   - Add these referrers:
     ```
     https://script.google.com/*
     https://sites.google.com/*
     *.googleusercontent.com/*
     https://script.googleusercontent.com/*
     https://zakpestsos.github.io/*
     ```
4. Under **API restrictions**:
   - Select **Restrict key**
   - Choose **Maps JavaScript API** and **Places API**
5. **Save** the restrictions

## Step 4: Add the Key to Your Intake Form

1. Open your Apps Script project
2. Edit the `intake.html` file
3. Find this line:
   ```javascript
   const PLACES_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
   ```
4. Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual API key

## Step 5: Test

1. Deploy your web app
2. Open the intake form
3. Start typing an address in the "Full Address" field
4. You should see Google's address suggestions appear
5. When you select an address, you'll see a toast confirmation showing the parsed street and city

## Troubleshooting

- Check browser console (F12) for error messages
- Verify your API key has the correct restrictions
- Make sure billing is enabled in Google Cloud (required for Maps APIs)
- Test with a simple address like "1600 Amphitheatre Parkway, Mountain View, CA"

## How It Works

When a user selects an address from the autocomplete:
- The address is automatically split into separate components
- Street, City, State, and Postal Code are stored separately
- These components are sent to your Google Sheet in the appropriate columns
- The user sees a confirmation toast showing the parsed address
