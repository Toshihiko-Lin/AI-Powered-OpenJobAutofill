# OpenJobAutofill

[中文 README](README.md)

<p align="center">
  <img src="assets/openjobautofill-logo.png" alt="OpenJobAutofill" width="720" />
</p>

OpenJobAutofill is an AI-assisted browser extension for job application forms. You keep one resume profile locally, open a recruiting website, click `Start Filling`, and the extension scans the current page, uses local rules plus optional AI to understand field meanings, fills fields it can determine, and marks the rest as pending.

It is not designed to be a fully automated job-submission bot. Its goal is to use AI where it helps most: understanding messy field names and page structures across different recruiting websites, while keeping your actual resume values on your device. Personal information, education, internships, projects, certificates, awards, and other common resume fields can be filled first, then reviewed and submitted by you.

If this project saves you time, a GitHub Star would be appreciated. Issues and feedback also help improve compatibility with more recruiting sites.

## Highlights

- One-click scanning for the current job application page: determined fields are filled, and the rest are marked as pending.
- Resume data stays on your device and does not need to be uploaded to a cloud service.
- Supports common inputs, textareas, radio buttons, checkboxes, dropdowns, and date-like fields.
- A profile panel lets you browse, search, and manually copy saved profile data for orange pending fields.
- Optional OpenAI-compatible API or custom API support for better page-field understanding.
- AI only helps identify page fields and matching profile-field names, not your actual resume values.
- Optionally upload an existing resume (PDF / DOCX / TXT / MD) and let AI parse it into profile sections; this is the only feature that sends the full resume text to AI and asks for confirmation each time.
- Fields you edit or fill in on a job form after autofill can be written back to the local profile with one click; every item is confirmed by you and values never pass through AI.
- Autofill results use three marks: green for filled fields, orange for fields that still need attention, and dashed orange for fields the profile does not have yet.
- GitHub Release update checks are supported; the extension icon shows `NEW` when a newer release is available.

## Installation

The current version can be installed in Brave, Chrome, or Firefox (140+) through developer mode.

No dependency installation or build step is required. Load the project folder directly.

### Brave / Chrome

1. Download or clone this repository to your computer.
2. Open `brave://extensions/` or `chrome://extensions/`.
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select the `OpenJobAutofill` project folder.
6. Pin the extension icon for easier access on job application pages.

### Firefox

1. Download or clone this repository to your computer.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click `Load Temporary Add-on…`.
4. Select `manifest.json` inside the project folder.
5. Pin the OpenJobAutofill icon from the toolbar extensions menu.

Firefox notes:

- Temporary add-ons are removed when Firefox closes and must be reloaded after a restart; your saved profile stays in extension storage.
- Firefox does not grant `api.github.com` access automatically. To enable update checks, open `about:addons` → OpenJobAutofill → `Permissions` and turn on the site permission.
- When configuring an AI endpoint, Firefox shows a site-access prompt; the API can be called only after you accept it.

## First Use

1. Click the OpenJobAutofill icon in the browser toolbar.
2. Click `Settings`.
3. Fill in your resume profile by section.
4. Click `Save Profile`; the data is saved to local browser extension storage.
5. Open a resume or application form page on a recruiting website.
6. Click the extension icon, then click `Start Filling`.
7. Wait for scanning and filling to complete, then review the green/orange marks on the page.
8. For orange pending fields, open the profile panel, search the value, and copy it manually.
9. Review the final form yourself and submit it manually.

The repository includes `sample-profile.json` if you want to test the extension before entering your own data.

### Upload a resume for automatic parsing (optional)

If you already have a resume file, click `Upload Resume to Auto-Parse` above the profile editor in the settings page instead of typing everything by hand:

1. Configure the API first (Base URL, model name, etc.). Resume parsing requires an AI endpoint.
2. Pick a PDF, DOCX, TXT, or MD file. Text extraction happens locally; scanned or image-only PDFs cannot be parsed.
3. Confirm the dialog: this step sends the full resume text to the API you configured, which differs from the default "AI never sees resume values" boundary.
4. Results are written into the editor. By default only empty fields are filled and sections that already contain entries are left untouched; tick `Overwrite existing values` to replace them.
5. Review every field, then click `Save Profile`; nothing is saved until you do.

Parsing quality depends on the model and the resume layout, so double-check dates and degree fields in particular.

### Update the profile from your edits on a job form

After `Start Filling`, changes you make on the page are recorded (on by default; toggle it under "Preferences" in the settings page):

- The floating card shows `N changes · update profile`; the popup also has an `Update Profile` button.
- Each entry states where it would go: **Update** (you changed an autofilled value, e.g. a new phone number), **Add** (you filled a field the profile lacks, e.g. a student ID), **Synonym** (the value equals an existing profile value under a different site label, e.g. "毕业学府" vs "学校" — only the label is remembered, no duplicate field), or **Custom field** (the page label matches no standard field).
- For repeatable sections you confirm which entry to write to, or create a new one; unmatched labels can be assigned manually or via `AI classify` (field names only, never your values).
- Nothing is saved until you tick items and click `Write to profile`; pure formatting differences (date style, dropdown wording) are ignored automatically.
- Unprocessed records persist across pages, so they are still there after moving to the next form step; the settings page can clear them.

If a field was autofilled incorrectly (a local-rule mismatch), your correction is written as an **Add** under the field named by the page label instead of overwriting the profile value that was wrongly used.

## AI Settings

AI is optional. If no API is configured, OpenJobAutofill still uses local rules to match and fill fields.

If you want better understanding of different recruiting websites, configure your own API in the settings page. OpenAI-compatible endpoints, custom Base URLs, endpoint paths, and model names are supported. `Test API Connection` only checks the current form values; click `Save API Settings` before using them for filling. `Refresh Model Suggestions` only updates model suggestions, and model names can still be entered manually.

The privacy boundary is explicit: AI requests contain the current page fields and local profile-field names only. They do not include your name, phone number, ID number, resume content, or other actual profile values. Value lookup and form filling happen locally in the browser.

The AI classify step in "Update Profile" likewise sends field names only. Two exceptions, both under your control:

- Resume auto-parsing has to send the full resume text to the model to split it into fields, so every use shows a confirmation dialog naming the destination.
- AI option matching (off by default in Preferences): when a dropdown/radio has no locally matching option (未婚 vs 单身, 全日制 vs 统招), the field's stored value and the page's option list are sent so the model can pick one. Only low-sensitivity fields qualify — degree, education level, study form, political/marital status, ethnicity, city, yes/no questions; names, phone numbers, ID numbers, addresses, student IDs, salary and family members are never sent.

## Updates

The extension periodically checks GitHub Releases. You can also click `Check for Updates` in the popup or settings page. If a newer release is available, the extension icon shows `NEW`; open the Release page and follow the release instructions to download and reload or replace the extension files.

Before updating, export a profile backup from the settings page. Do not uninstall the extension before updating; as long as the same browser extension remains installed, your saved resume profile and API settings stay in local browser storage.

## Color Marks

- Green: filled.
- Orange: pending — the profile has a matching value but it could not be filled automatically; handle or review it manually.
- Dashed orange: the profile has no such field yet; fill it by hand, then write it back via "Update Profile" so it autofills next time.

If the page refreshes, moves to another step, or dynamically loads new fields, click `Start Filling` again.

## Privacy

- Resume data is stored locally in your browser.
- API keys are stored only in local extension storage.
- Page scripts are injected only after you click the extension and interact with the current page.
- The extension never clicks the final submit button automatically.
- The extension never sends your actual resume values to AI, except when you explicitly use resume auto-parsing, which sends the full resume text to your own configured API after confirmation.
- Update checks only access this project's GitHub Releases and do not upload resume data.
- Always review the page after autofill, especially IDs, contact information, dates, choice fields, and declaration fields.

## FAQ

### Nothing happens after clicking Start Filling

Refresh the target page and open the extension popup again. If it still does not respond, reload OpenJobAutofill from the browser extension management page.

### Why do some dropdowns or date fields become pending?

Recruiting systems implement controls in many different ways. Some are complex components rather than normal inputs. In this case, the field may be marked as pending; use the profile panel to search and copy the value manually. If the same website or control type often needs manual handling, please open an Issue so it can be investigated.

### How do multi-page forms work?

Click `Start Filling` again after moving to a new page or step. OpenJobAutofill does not automatically continue across pages and does not submit applications.

### How do I back up or migrate my profile?

Use `Export Profile Backup` and `Import Profile Backup` in the settings page. The exported file uses OpenJobAutofill's own backup format and is intended for moving data between browsers or computers.

### Resume parsing fails or extracts no text

Make sure `Test API Connection` succeeds first. Scanned or image-only PDFs contain no extractable text; use a DOCX or save the resume as text instead. Legacy `.doc` files must be converted to `.docx`. If the model response cannot be parsed, try another model or enable the `response_format` option.

### How do I clear local data?

Open the settings page and click `Clear Profile and API Settings`. This removes the saved resume profile and API configuration from the current browser.

## Feedback

If you run into a problem, want support for a specific recruiting website, or have a feature request, please open an Issue. Including the website name, screenshots, and pending-field descriptions will make the issue easier to reproduce.

You can also check my GitHub profile for a public email address.

Community link: [LINUX DO](https://linux.do) - A Chinese community for tech enthusiasts. This project links to and recognizes LINUX DO for discussion and feedback.

## License

OpenJobAutofill is open-sourced under the MIT License. See [LICENSE](LICENSE) for details.

`src/vendor/` bundles [pdf.js](https://github.com/mozilla/pdf.js) (Mozilla, Apache License 2.0), used only to extract PDF text locally. See `src/vendor/LICENSE.pdfjs`.
