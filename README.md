<div align="center">

<img src="assets/code-green-header.svg" alt="CODE GREEN 2026 — 8th MIMAROPA Regional IT Congress" width="100%">

<br>

<h3>QR-Based Attendee Check-In & Validation System</h3>

<p>
  <strong>Built exclusively for the 8th MIMAROPA Regional IT Congress</strong>
</p>

<p>
  <code>HTML5</code>
  <code>CSS3</code>
  <code>JavaScript</code>
  <code>Google Apps Script</code>
  <code>Google Sheets</code>
  <code>GitHub Pages</code>
</p>

</div>

---

## System Preview

<div align="center">

| Registration | QR Check-In | Validation | Result |
|:---:|:---:|:---:|:---:|
| Google Form | Camera Scanner | Apps Script | Responsive Popup |
| Attendee ID + QR | Mobile / Tablet / Laptop | Station Rules | Status + Timestamp |

</div>

```text
Google Form
     |
     v
Attendee Registration
     |
     v
Attendee ID + QR Code
     |
     v
+--------------------------+
|     CODE GREEN 2026      |
|      QR CHECK-IN         |
|                          |
|   [ QR CAMERA VIEW ]     |
|                          |
| Attendance | AM | PM     |
|                          |
|   [ ATTENDEE ID ]        |
+------------+-------------+
             |
             v
     Google Apps Script
             |
      +------+------+
      |             |
      v             v
   Validate       Record
   Station        Timestamp
      |             |
      +------+------+
             |
             v
       Google Sheet
             |
             v
+--------------------------+
|      SCAN RESULT         |
|                          |
|   SCAN SUCCESSFULLY      |
|   ATTENDEE NAME          |
|   ATTENDEE ID            |
|   TIMESTAMP              |
|                          |
|   CONTINUE SCANNING      |
+--------------------------+
```

---

## Purpose

This system is a dedicated event check-in and validation interface for the **8th MIMAROPA Regional IT Congress — CODE GREEN 2026**.

It is designed to provide fast QR-based attendee verification and station tracking while keeping the operator interface responsive across **mobile phones, tablets, and laptops**.

> **Scope:** This repository is intended solely for the attendance and event-validation operations of the MIMAROPA IT Congress.

---

## Check-In Flow

### 01 — Attendance

The attendee scans the QR code for the first required checkpoint.

```text
First Scan  →  SCAN SUCCESSFULLY
Repeat Scan →  ALREADY SCANNED
```

### 02 — AM Snack

AM Snack can only be claimed after Attendance has been recorded.

```text
Attendance missing → TRY AGAIN / DENIED
Already claimed    → ALREADY SCANNED
Valid               → SCAN SUCCESSFULLY
```

### 03 — PM Snack

PM Snack requires both Attendance and AM Snack.

```text
Attendance missing → TRY AGAIN / DENIED
AM Snack missing   → TRY AGAIN / DENIED
Already claimed    → ALREADY SCANNED
Valid               → SCAN SUCCESSFULLY
```

---

## Result Interface

The scan result is presented as a responsive popup so the operator receives immediate feedback.

<div align="center">

### Successful Scan

```text
┌─────────────────────────────────┐
│                                 │
│          SCAN SUCCESSFULLY      │
│                                 │
│          ATTENDEE NAME          │
│          ATT-IND-XXXX           │
│                                 │
│       09/10/2026 · 07:57 PM     │
│                                 │
│    Attendance recorded          │
│    successfully.                │
│                                 │
│       CONTINUE SCANNING         │
└─────────────────────────────────┘
```

### Duplicate Scan

```text
┌─────────────────────────────────┐
│                                 │
│          ALREADY SCANNED        │
│                                 │
│          ATTENDEE NAME          │
│          ATT-IND-XXXX           │
│                                 │
│       09/10/2026 · 07:57 PM     │
│                                 │
│    This station was already     │
│    recorded for this attendee.  │
│                                 │
│       CONTINUE SCANNING         │
└─────────────────────────────────┘
```

</div>

---

## Responsive Interface

The frontend adapts to the device being used at the event.

```text
MOBILE
┌──────────────────────┐
│   CODE GREEN 2026    │
├──────────────────────┤
│                      │
│      QR CAMERA       │
│                      │
├──────────────────────┤
│   ATTENDANCE         │
│   AM SNACK           │
│   PM SNACK           │
├──────────────────────┤
│   ATTENDEE ID        │
│   [              ]   │
│       SUBMIT         │
└──────────────────────┘


TABLET
┌────────────────────┬───────────────────┐
│                    │                   │
│     QR CAMERA      │  STATION CONTROL  │
│                    │                   │
│                    │  ATTENDANCE       │
│                    │  AM SNACK         │
│                    │  PM SNACK         │
└────────────────────┴───────────────────┘


LAPTOP
┌──────────────────────────┬──────────────────────────┐
│                          │                          │
│        QR CAMERA         │     STATION CONTROLS     │
│                          │                          │
│                          │     ATTENDANCE            │
│                          │     AM SNACK              │
│                          │     PM SNACK              │
│                          │                          │
│                          │     ATTENDEE ID           │
└──────────────────────────┴──────────────────────────┘
```

---

## Visual Design

The CODE GREEN interface uses a blue-and-green visual system with:

- Deep navy backgrounds
- Blue-to-green gradients
- Cyan highlights
- Emerald accents
- Glassmorphism panels
- Neumorphism-inspired controls
- Soft shadows
- Rounded surfaces
- Responsive spacing
- Clear success, warning, and error states

The visual design is intentionally optimized for **fast event operations**, keeping important information prominent without unnecessary interface clutter.

---

## Frontend Structure

```text
CODE-GREEN-2026/
│
├── index.html
├── style.css
├── script.js
├── code-green-header.svg
└── README.md
```

### `index.html`

Page structure and interface components.

### `style.css`

Responsive layout, visual theme, glassmorphism/neumorphism styling, modal design, and animations.

### `script.js`

QR scanning, backend communication, validation-result handling, popup behavior, sound feedback, and UI animations.

### `code-green-header.svg`

Lightweight scalable event header used by this README. SVG keeps the header sharp across desktop and mobile displays.

---

## Backend Architecture

```text
                FRONTEND
                   |
                   | attendeeId + session
                   v
        +------------------------+
        |   GOOGLE APPS SCRIPT   |
        |     VALIDATION API     |
        +-----------+------------+
                    |
          +---------+---------+
          |                   |
          v                   v
   Validate attendee      Validate station
          |                   |
          +---------+---------+
                    |
                    v
             Google Sheet
                    |
                    v
             JSON Response
                    |
                    v
             Result Popup
```

The backend is responsible for the authoritative validation of attendee and station status.

---

## Registration & QR Workflow

```text
Google Form
    |
    v
Form Submission Trigger
    |
    v
Generate Attendee ID
    |
    v
Generate QR Code
    |
    v
Generate Event Pass Email
    |
    v
Attendee receives QR
    |
    v
QR used at event check-in
```

---

## Manual Override

A manual override is available for exceptional operational cases.

```text
Manual Override
      |
      v
Attendee ID
      |
      v
Authorization
      |
      v
Validate Request
      |
      v
Apply Station Action
      |
      v
Record Timestamp
```

Authorization credentials should **never be committed to a public GitHub repository**.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Interface | HTML5 |
| Styling | CSS3 |
| Client Logic | JavaScript |
| QR Scanning | `html5-qrcode` |
| Hosting | GitHub Pages |
| Backend | Google Apps Script |
| Records | Google Sheets |
| Registration | Google Forms |
| Email | Apps Script Mail Service |

---

## Event-Day Checklist

```text
[ ] Google Form verified
[ ] Google Sheet verified
[ ] Apps Script trigger verified
[ ] QR generation verified
[ ] Registration email verified
[ ] Camera permission verified
[ ] Attendance tested
[ ] AM Snack tested
[ ] PM Snack tested
[ ] Duplicate scan tested
[ ] Invalid attendee tested
[ ] Manual override tested
[ ] Mobile UI tested
[ ] Tablet UI tested
[ ] Laptop UI tested
[ ] Timestamp verified
[ ] GitHub Pages verified
[ ] Apps Script Web App verified
```

---

## Security

For deployment:

- Do not publish authorization PINs.
- Do not commit API keys or credentials.
- Restrict Google Sheet access to authorized personnel.
- Keep sensitive configuration in Apps Script rather than public frontend code.
- Use HTTPS for the public check-in interface.
- Treat attendee records as operational data and limit access appropriately.

---

## Deployment

### Frontend

The interface can be deployed using GitHub Pages:

```text
GitHub Repository
       |
       v
GitHub Pages
       |
       v
HTTPS Check-In Interface
```

### Backend

Google Apps Script remains responsible for validation and Google Sheet updates.

---

<div align="center">

### CODE GREEN 2026

**8th MIMAROPA Regional IT Congress**

<sub>QR-Based Attendee Check-In & Validation System</sub>

<br><br>

<sub>Built exclusively for the attendance and event-validation operations of the MIMAROPA IT Congress.</sub>

</div>
