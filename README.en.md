# AI-Powered OpenJobAutofill

[中文 README](README.md)

This is my continuation of [Br1an67/OpenJobAutofill](https://github.com/Br1an67/OpenJobAutofill), a browser extension for filling out job application forms. The upstream project proved the core idea: local rules plus optional AI that understands page fields, with resume data staying on your device and AI seeing field names only. I took that idea to the two remaining ends of the workflow: **reading your resume into the profile**, and **learning what you type on application forms back into the profile**.

The result is a loop:

1. **Upload a resume to auto-parse** — drop in a PDF / DOCX and AI splits it into profile sections instead of you typing everything.
2. **One-click autofill** — open a recruiting site, click `Start Filling`, and determined fields are filled while the rest are marked.
3. **Update the profile from your edits** — anything you changed or added on the form can be written back with a tick, so the next application fills it automatically.

Campus recruiting means dozens of applications, each with a few fields your profile does not have yet. The point of the loop is simple: nothing should have to be typed twice.

## What this fork adds

| Capability | Notes |
|---|---|
| Resume upload auto-parse | New entry in settings; PDF (bundled pdf.js), DOCX (native inflate, zero deps), TXT, MD; fill-empty-only or overwrite |
| Learn from form edits | Watches the page after autofill, floating card shows N changes; review panel distinguishes update / add / custom field, repeatable sections let you pick the entry; records persist across pages; unmatched labels can be AI-classified (field names only) |
| Missing-field marks | Fields the profile lacks are outlined in dashed orange with a `missing N` count, so you see at a glance what still needs typing |
| Mis-fill protection | If a local-rule match was wrong, your correction is added under the page's own label instead of overwriting the correct profile value |
| Synonym learning | When a hand-typed value equals an existing profile value ("毕业学府" = "学校"), only the site's label is remembered so it matches next time — no duplicate field |
| Multi-entry alignment | Two consecutive education/internship blocks on a page map to profile entries 1 and 2 instead of both getting entry 1 |
| Exact-label pass | A page label identical to a profile field label (including common aliases and learned synonyms) matches directly and overrides fuzzy mis-matches |
| Automatic AI classification | Opening the review panel lets AI place unmatched labels (field names only) and decide synonym vs. new field |
| AI option matching (opt-in) | When dropdown/radio wording differs (未婚 vs 单身, 全日制 vs 统招) AI picks the closest option; off by default, low-sensitivity fields only |
| Firefox fix | Content-script injection paths are root-anchored, fixing "Receiving end does not exist" on Firefox |
| Preferences | Toggle live tracking, clear pending records |

Page scanning, field matching, the profile panel, and the privacy design of AI field understanding all come from upstream; I did not rewrite them.

## Highlights

- One-click scanning of the current application page: determined fields filled, the rest marked.
- Resume data stays in your browser; nothing is uploaded to a cloud service.
- Upload a PDF / DOCX / TXT / MD resume and let AI parse it into profile sections.
- Fields you edit or fill on a form can be written back to the profile with one click.
- Supports common inputs, textareas, radios, checkboxes, dropdowns, and date-like fields.
- A profile panel to browse, search, and copy values for pending fields.
- Optional OpenAI-compatible or custom API.
- Three marks on the page: green filled, orange pending, dashed orange missing from profile.
- GitHub Release update check; the icon shows `NEW` when a newer version exists.

## Installation

Developer-mode install on Brave, Chrome, or Firefox (140+). No dependencies, no build step — load the project directory.

### Brave / Chrome

1. Clone or download: `git clone https://github.com/Toshihiko-Lin/AI-Powered-OpenJobAutofill`
2. Open `brave://extensions/` or `chrome://extensions/` and enable `Developer mode`.
3. Click `Load unpacked` and select the project directory.
4. Pin the extension icon.

### Firefox

1. Clone or download the repository.
2. Open `about:debugging#/runtime/this-firefox`, click `Load Temporary Add-on…`, and select `manifest.json`.
3. Pin the icon from the toolbar extensions menu.

Firefox notes:

- Temporary add-ons are removed when Firefox closes; reload after restart. Saved data stays in extension storage.
- After reloading the add-on, **refresh** any open recruiting page before clicking `Start Filling`, otherwise the stale content script is still attached.
- Firefox does not grant `api.github.com` automatically; enable it under `about:addons` → Permissions if you want update checks.
- The first AI request prompts for site access; allow it to proceed.

## First Use

1. Click the extension icon → `Settings`.
2. Build your profile, any of three ways:
   - **Upload a resume** (recommended): configure the API below first, then click `Upload Resume to Auto-Parse` above the profile editor and choose a PDF / DOCX.
   - Import `sample-profile.json` to try it out.
   - Fill the sections by hand.
3. Review each field, then `Save Profile`.
4. Open an application form, click the icon → `Start Filling`.
5. Read the marks: green filled, orange pending, dashed orange means the profile lacks the field — type it.
6. When you finish the page, the floating card offers `N changes · update profile`; tick and write back.
7. Review and submit yourself. For multi-step forms, click `Start Filling` again on each step.

## Resume upload auto-parse

- Text extraction is local: pdf.js for PDF, the browser's native inflate for DOCX, no online service. Scanned / image-only PDFs yield no text — use DOCX or plain text.
- A confirmation dialog states the file name, character count, and destination. **This step sends the full resume text to the API you configured**, which differs from the default "AI never sees resume values" boundary.
- By default only empty fields are filled and populated sections are left alone; tick `Overwrite existing values` to replace.
- Results land in the editor; nothing is saved until `Save Profile`. Double-check dates and degree fields.

## Update the profile from form edits

After `Start Filling`, changes on the page are recorded (on by default; toggle under Preferences in settings):

- The floating card shows `N changes · update profile`; the popup has an `Update Profile` button, which also works as a manual comparison when live tracking is off.
- Each record names its destination:
  - **Update**: you changed an autofilled value, e.g. a new phone number → update that profile item.
  - **Add**: you filled a field the profile lacks, e.g. a student ID → write it into the matching section; repeatable sections ask which entry, or create a new one.
  - **Synonym**: the value you typed equals an existing profile value under a different label ("毕业学府" vs "学校") → only the site's wording is remembered, so it matches next time without a duplicate field.
  - **Custom field**: the page label matches no standard field → with an API configured, opening the panel classifies it automatically (field names only, never values; can be disabled in Preferences), or pick a section manually.
- Pure formatting differences (date style, dropdown wording) are ignored.
- Nothing is saved until you tick and click `Write to profile`. Unprocessed records persist across pages; settings can clear them.

## AI Settings

AI is optional. Without an API, autofill still uses local rules; resume parsing and AI classify require one.

OpenAI-compatible endpoints (Base URL + path + model) and custom request templates are supported. `Test API Connection` and `Refresh Model Suggestions` are in settings; model names can be typed manually.

**Privacy boundary**: autofill and AI classify send page field names and local profile field names only — no names, phone numbers, ID numbers, or experience text; lookup and filling happen locally. Two exceptions, both under your control:

- **Resume upload parsing** must send the full resume text and asks for confirmation every time.
- **AI option matching** (off by default in Preferences): when a dropdown/radio has no locally matching option, the field's stored value and the page's option list are sent so the model can pick one. Only low-sensitivity fields qualify — degree, education level, study form, political status, marital status, ethnicity, city, yes/no questions; names, phone numbers, ID numbers, addresses, student IDs, salary and family members are never sent.

## Updates

The extension periodically checks this repository's GitHub Releases; you can also click `Check for Updates` in the popup or settings. When a newer version exists the icon shows `NEW`; open the release page, download, and overwrite or reload.

Export a profile backup before updating. Do not uninstall first — overwriting or reloading keeps local data and API settings.

## Color Marks

- Green: filled.
- Orange: pending — the profile has a matching value but it could not be filled automatically; handle or review manually.
- Dashed orange: the profile has no such field yet; fill it by hand, then write it back via "Update Profile" so it autofills next time.

## Privacy

- Resume data and API keys live only in local extension storage.
- Page scripts are injected only after you click the extension on the current page.
- The extension never clicks the final submit button.
- Autofill and AI classify never send resume values; resume upload parsing sends the full resume text to your own configured API after confirmation; AI option matching is off by default and, when enabled, sends low-sensitivity field values only.
- Values recorded by "Update Profile" stay local and require explicit per-item confirmation before being written.
- Update checks only access this repository's GitHub Releases.
- Always review the page after autofill, especially IDs, contact details, dates, choice fields, and declarations.

## FAQ

### Nothing happens on Start Filling, or "Receiving end does not exist"

Refresh the target page and reopen the popup. On Firefox, reloading the add-on requires refreshing already-open pages. If it persists, reload the extension from the extensions page.

### Why do some dropdowns or date fields become pending?

Recruiting systems implement controls very differently; complex widgets fall back to pending. Use the profile panel to search and pick manually, and open an Issue if a site does this consistently.

### Resume parsing fails or extracts no text

Make sure `Test API Connection` passes. Scanned PDFs contain no text — use DOCX or plain text; convert legacy `.doc` to `.docx`. If the model response cannot be parsed, try another model or enable `response_format`.

### My edit is not in the Update Profile panel

Only changes made after `Start Filling` are tracked, and checkboxes / radios are not. If something is missing, click `Update Profile` in the popup to force a comparison.

### Backup, migrate, or clear data

`Export Profile Backup` / `Import Profile Backup` in settings; `Clear Profile and API Settings` removes all local data.

## Feedback

Open an Issue on this repository for bugs, site support, or feature ideas — include the site name, screenshots, and pending-field descriptions. You can also reach me via my GitHub profile, [@Toshihiko-Lin](https://github.com/Toshihiko-Lin).

If this saves you time on applications, a Star is appreciated.

## Acknowledgements

- [Br1an67/OpenJobAutofill](https://github.com/Br1an67/OpenJobAutofill): the upstream project. Page scanning, local-rule matching, the profile panel, and the privacy design of AI field understanding are the original author's work; this fork builds on top of them. Thanks also to [LINUX DO](https://linux.do), the community the upstream author recommends.
- [pdf.js](https://github.com/mozilla/pdf.js) (Mozilla, Apache License 2.0): bundled in `src/vendor/` solely for local PDF text extraction; see `src/vendor/LICENSE.pdfjs`.

## License

MIT License. The upstream copyright notice of Br1an67 is retained; additions in this fork are © Lin Junyan. See [LICENSE](LICENSE).
