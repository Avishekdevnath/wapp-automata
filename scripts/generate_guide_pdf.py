import os
import shutil
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and render total page count."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Top thin decorative rule
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(40, 755, 572, 755)

        # Header running text
        self.drawString(40, 760, "TELCIA AI TERMINAL  •  OPERATOR QUICKSTART GUIDE")
        self.drawRightString(572, 760, "CONFIDENTIAL & PROPRIETARY")

        # Bottom rule
        self.line(40, 42, 572, 42)

        # Footer text
        self.drawString(40, 30, "Bijoytel Network  •  Sovereign Telecom Node  •  https://telcia.bijoytel.network")
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(572, 30, page_str)
        self.restoreState()


def build_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=46,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#070d18")
    )

    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#006a4e")
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=colors.HexColor("#006a4e"),
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#1e293b")
    )

    body_bold = ParagraphStyle(
        'Body_Bold_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#0f172a")
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a")
    )

    elements = []

    # =========================================================================
    # PAGE 1: TITLE, CREDENTIALS, QUICKSTART, CORE MODULES
    # =========================================================================

    # Title & Branding Banner
    title_cell = [
        Paragraph("TELCIA  <font color='#f42a41'>•</font>  Operator Quickstart Guide", title_style),
        Spacer(1, 2),
        Paragraph("Telecom Cognitive Intelligent Agent — Sovereign Wholesale Trading Terminal", subtitle_style)
    ]
    badge_cell = [
        Paragraph("<para align='right'><font size='7' color='#64748b'>SECURITY ENCRYPTION</font><br/><b><font size='10' color='#006a4e'>TLS 1.3 / E2EE</font></b><br/><font size='7' color='#059669'>● PRODUCTION GATEWAY</font></para>", styles['Normal'])
    ]

    header_table = Table([[title_cell, badge_cell]], colWidths=[380, 152])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10))

    # SECTION 1: Credentials & Access
    elements.append(Paragraph("1. ACCESS CREDENTIALS & INITIAL SETUP", h1_style))
    
    cred_data = [
        [Paragraph("<b>Portal URL</b>", body_style), Paragraph("<font color='#006a4e'><b>https://telcia.bijoytel.network</b></font>", body_bold)],
        [Paragraph("<b>Initial Password</b>", body_style), Paragraph("<font color='#0f172a'><b>telcia_bd_2026</b></font>  <i>(Initial Master Unlock Password)</i>", code_style)],
        [Paragraph("<b>Backup Password</b>", body_style), Paragraph("<font color='#475569'><b>telcia_bd_2027</b></font>  <i>(Emergency Standby Password)</i>", code_style)],
        [Paragraph("<b>Password Security</b>", body_style), Paragraph("Update your password anytime in <b>Settings → Security & Password</b>. For recovery, use WhatsApp OTP.", body_style)],
        [Paragraph("<b>Theme Controls</b>", body_style), Paragraph("Equipped with responsive <b>Light / Dark Mode</b> (Sun/Moon pill on top-right of lock screen and header).", body_style)],
    ]
    cred_table = Table(cred_data, colWidths=[120, 412])
    cred_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(cred_table)
    elements.append(Spacer(1, 10))

    # SECTION 2: 3-Step Setup
    elements.append(Paragraph("2. CONNECTING WHATSAPP (3-MINUTE SETUP)", h1_style))
    step_data = [
        [
            Paragraph("<b>STEP 1: Log In</b>", body_bold),
            Paragraph("Navigate to <b>https://telcia.bijoytel.network</b>. Enter the initial password <b>telcia_bd_2026</b> and click <b>Unlock Terminal</b> (or press Enter).", body_style)
        ],
        [
            Paragraph("<b>STEP 2: Pair Device</b>", body_bold),
            Paragraph("In the top navigation header or under <b>Settings</b>, click <b>WhatsApp Connection</b>. Click <b>Connect WhatsApp</b> to generate your pairing QR code.", body_style)
        ],
        [
            Paragraph("<b>STEP 3: Scan QR Code</b>", body_bold),
            Paragraph("On your trader/operator phone: Open <b>WhatsApp → Linked Devices → Link a Device</b>. Scan the screen QR code. Status will flip to <b>Connected</b>. <i>Allow 2–3 minutes for initial group message sync.</i>", body_style)
        ]
    ]
    step_table = Table(step_data, colWidths=[120, 412])
    step_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
        ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor("#86efac")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#bbf7d0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(step_table)
    elements.append(Spacer(1, 10))

    # SECTION 3: Workspace Navigation Matrix
    elements.append(Paragraph("3. CORE MODULES & WORKSPACE MATRIX", h1_style))
    mod_data = [
        [Paragraph("<b>Module</b>", body_bold), Paragraph("<b>Path</b>", body_bold), Paragraph("<b>Primary Function & Wholesale Purpose</b>", body_bold)],
        [
            Paragraph("<b>Route Matrix</b>", body_style),
            Paragraph("<font color='#047857'>/routes</font>", code_style),
            Paragraph("Wholesale buying bids and selling offers automatically parsed from carrier chats. Filter by country, carrier, rate, and currency (USD, EUR, GBP). Knock traders directly on WhatsApp.", body_style)
        ],
        [
            Paragraph("<b>Market Trends</b>", body_style),
            Paragraph("<font color='#0284c7'>/trends</font>", code_style),
            Paragraph("Historical destination pricing charts, carrier liquidity curves, and rate volatility benchmarks across all participating wholesale groups.", body_style)
        ],
        [
            Paragraph("<b>AI Insights</b>", body_style),
            Paragraph("<font color='#b45309'>/insights</font>", code_style),
            Paragraph("Real-time automated arbitrage spread detection. Instantly flags profitable opportunities where Vendor A offers a destination cheaper than Vendor B is seeking to buy.", body_style)
        ],
        [
            Paragraph("<b>Telco News</b>", body_style),
            Paragraph("<font color='#e11d48'>/news</font>", code_style),
            Paragraph("Real-time carrier escalation notices, subsea fiber cuts, latency degradation alerts, maintenance windows, and regulatory updates.", body_style)
        ],
        [
            Paragraph("<b>Carriers Directory</b>", body_style),
            Paragraph("<font color='#7c3aed'>/vendors</font>", code_style),
            Paragraph("Directory of verified carrier desks, trade groups, representative contacts, and ASN associations.", body_style)
        ],
        [
            Paragraph("<b>Live Stream</b>", body_style),
            Paragraph("<font color='#0f766e'>/stream</font>", code_style),
            Paragraph("Zero-loss, real-time message stream across all linked carrier groups with live AI JSON parser inspection.", body_style)
        ],
        [
            Paragraph("<b>Settings & Security</b>", body_style),
            Paragraph("<font color='#334155'>/settings</font>", code_style),
            Paragraph("Manage WhatsApp session pairing, change operator password, configure sidebar preferences, toggle audio chime alerts, and view storage telemetry.", body_style)
        ],
    ]
    mod_table = Table(mod_data, colWidths=[100, 65, 367])
    mod_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e2e8f0")),
        ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor("#94a3b8")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(mod_table)

    # =========================================================================
    # PAGE BREAK: Clean, un-split transition to Page 2
    # =========================================================================
    elements.append(PageBreak())

    # =========================================================================
    # PAGE 2: SHORTCUTS, BEST PRACTICES, SECURITY & RECOVERY
    # =========================================================================

    # SECTION 4: Shortcuts & Ergonomics
    elements.append(Paragraph("4. OPERATOR SHORTCUTS & PRODUCTIVITY TIPS", h1_style))
    tips_data = [
        [
            Paragraph(r"<b>Collapse Sidebar ( \ )</b>", body_bold),
            Paragraph(r"Press <b>\</b> (backslash) or click the menu button to collapse the sidebar into an icon rail, giving full width for trading tables.", body_style)
        ],
        [
            Paragraph("<b>Audio Chime Alerts</b>", body_bold),
            Paragraph("Click the <b>Speaker</b> icon in the top header to toggle audio chimes when high-value arbitrage signals or news alerts arrive.", body_style)
        ],
        [
            Paragraph("<b>Direct WhatsApp Knocks</b>", body_bold),
            Paragraph("Click the WhatsApp icon next to any vendor or route to instantly open a pre-filled direct trading chat in WhatsApp Web or desktop.", body_style)
        ],
        [
            Paragraph("<b>Instant Search & Filter</b>", body_bold),
            Paragraph("Use the filter bar on the Route Matrix to instantly isolate destinations, currencies, or price thresholds in milliseconds.", body_style)
        ]
    ]
    tips_table = Table(tips_data, colWidths=[140, 392])
    tips_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(tips_table)
    elements.append(Spacer(1, 12))

    # SECTION 5: WhatsApp Companion Reliability
    elements.append(Paragraph("5. CARRIER WHATSAPP RELIABILITY & SYNC BEST PRACTICES", h1_style))
    sync_data = [
        [
            Paragraph("<b>Initial History Sync</b>", body_bold),
            Paragraph("When pairing for the first time, keep your companion phone unlocked on Wi-Fi for 3–5 minutes. WhatsApp Multi-Device sends back-history chunks in the background.", body_style)
        ],
        [
            Paragraph("<b>Battery Saver Exemption</b>", body_bold),
            Paragraph("Ensure WhatsApp on your physical phone is exempt from aggressive battery optimization (Background App Refresh enabled) to prevent silent socket closures.", body_style)
        ],
        [
            Paragraph("<b>Multi-Group Capacity</b>", body_bold),
            Paragraph("Telcia effortlessly monitors 100+ active carrier groups simultaneously. All inbound messages are safely queued in durable SQLite before AI extraction.", body_style)
        ],
        [
            Paragraph("<b>Zero-Loss Persistence</b>", body_bold),
            Paragraph("Even if the client browser window is closed, the Telcia background collector continues running 24/7 on the VPS, ensuring no carrier deals are ever missed.", body_style)
        ]
    ]
    sync_table = Table(sync_data, colWidths=[140, 392])
    sync_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdfa")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#99f6e4")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#ccfbf1")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(sync_table)
    elements.append(Spacer(1, 12))

    # SECTION 6: Security, Recovery & Operations
    elements.append(Paragraph("6. DESK ISOLATION & EMERGENCY RECOVERY", h1_style))
    sec_data = [
        [
            Paragraph("<b>Single-Desk Isolation</b>", body_bold),
            Paragraph("Every trading desk operates with complete data isolation. Routes, chats, and vendor records are stored in dedicated encrypted local SQLite databases.", body_style)
        ],
        [
            Paragraph("<b>Emergency WhatsApp OTP</b>", body_bold),
            Paragraph("If you forget your password, click <b>'Forgot password?'</b> on the login screen. Telcia automatically dispatches a secure 6-digit one-time code to your paired WhatsApp.", body_style)
        ],
        [
            Paragraph("<b>Interactive AI Concierge</b>", body_bold),
            Paragraph("Access <b>/help</b> inside the terminal for comprehensive guidance on carrier pairing, queue health, webhook verification, and troubleshooting.", body_style)
        ],
        [
            Paragraph("<b>Infrastructure Operator</b>", body_bold),
            Paragraph("Operated by <b>Bijoytel Network</b>. High-availability sovereign telecommunications node with TLS 1.3 encryption and automated durable queueing.", body_style)
        ]
    ]
    sec_table = Table(sec_data, colWidths=[140, 392])
    sec_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(sec_table)

    # Build document with NumberedCanvas
    doc.build(elements, canvasmaker=NumberedCanvas)
    print(f"Successfully generated: {output_path}")

if __name__ == '__main__':
    root_pdf = "CLIENT_QUICKSTART_GUIDE.pdf"
    build_pdf(root_pdf)

    # Distribute locally
    targets = [
        os.path.join("frontend", "public", "CLIENT_QUICKSTART_GUIDE.pdf"),
        os.path.join("backend", "public", "CLIENT_QUICKSTART_GUIDE.pdf"),
    ]
    for target in targets:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copy2(root_pdf, target)
        print(f"Copied to: {target}")

    # Also distribute text and markdown files
    txt_targets = [
        (os.path.join("frontend", "public", "CLIENT_QUICKSTART_GUIDE.txt"), "CLIENT_QUICKSTART_GUIDE.txt"),
        (os.path.join("backend", "public", "CLIENT_QUICKSTART_GUIDE.txt"), "CLIENT_QUICKSTART_GUIDE.txt"),
        (os.path.join("frontend", "public", "CLIENT_QUICKSTART_GUIDE.md"), "CLIENT_QUICKSTART_GUIDE.md"),
        (os.path.join("backend", "public", "CLIENT_QUICKSTART_GUIDE.md"), "CLIENT_QUICKSTART_GUIDE.md"),
    ]
    for dest, src in txt_targets:
        if os.path.exists(src):
            shutil.copy2(src, dest)
            print(f"Copied {src} to: {dest}")
