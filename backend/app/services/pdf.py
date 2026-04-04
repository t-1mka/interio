import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from app.config import settings


def generate_pdf(application) -> str:
    """Generate PDF report for the application."""
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"design_{application.share_link}.pdf"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=24,
        textColor=colors.HexColor("#1a1a2e"),
        spaceAfter=20,
        alignment=1,
    )
    
    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#e94560"),
        spaceBefore=15,
        spaceAfter=8,
    )
    
    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#333333"),
        spaceAfter=6,
        leading=16,
    )

    story = []

    # Title
    story.append(Paragraph("🏠 СвойСтиль — Ваш дизайн-проект", title_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#e94560")))
    story.append(Spacer(1, 20))

    # Contact info
    story.append(Paragraph("Клиент", heading_style))
    contact_data = [
        ["Имя:", application.contact_name],
        ["Телефон:", application.contact_phone],
        ["Email:", application.contact_email or "—"],
        ["Промокод:", application.promo_code or "—"],
    ]
    t = Table(contact_data, colWidths=[5 * cm, 12 * cm])
    t.setStyle(TableStyle([
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#666666")),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 15))

    # Design details
    story.append(Paragraph("Параметры дизайна", heading_style))
    design_data = [
        ["Помещение:", application.room or "—"],
        ["Стиль:", application.style or "—"],
        ["Бюджет:", f"{application.budget_min}–{application.budget_max} тыс. руб."],
        ["Сроки:", application.deadline or "—"],
        ["Цвета:", ", ".join(application.colors or [])],
    ]
    t2 = Table(design_data, colWidths=[5 * cm, 12 * cm])
    t2.setStyle(TableStyle([
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#666666")),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8f9fa")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#f8f9fa"), colors.white]),
    ]))
    story.append(t2)
    story.append(Spacer(1, 15))

    # Wishes
    if application.wishes:
        story.append(Paragraph("Пожелания", heading_style))
        story.append(Paragraph(application.wishes, body_style))
        story.append(Spacer(1, 15))

    # AI Description
    if application.ai_description:
        story.append(Paragraph("Концепция дизайна", heading_style))
        story.append(Paragraph(application.ai_description, body_style))
        story.append(Spacer(1, 15))

    # Cost estimate
    if application.estimated_cost:
        story.append(Paragraph("Оценочная стоимость", heading_style))
        story.append(Paragraph(
            f"<b>{application.estimated_cost:,.0f} руб.</b> (предварительная оценка)",
            body_style
        ))
        story.append(Spacer(1, 15))

    # Footer
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        f"Ссылка на проект: {settings.FRONTEND_URL}/result/{application.share_link}",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#999999"))
    ))
    story.append(Paragraph(
        "© СвойСтиль — Профессиональный дизайн интерьера",
        ParagraphStyle("Footer2", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#999999"), alignment=1)
    ))

    doc.build(story)
    return f"{settings.BASE_URL}/uploads/{filename}"
