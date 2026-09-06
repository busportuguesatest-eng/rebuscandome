# Rebuscándome — QA cierre funcional

- Admin afiliados: corrected commission column mismatch so profile modal resolves affiliates.
- Notifications: read_at alignment + DB triggers for support messages, payout requests and confirmed sales.
- Resources: production `materials.content` column aligned with app.
- Delivery: file delivery plus HTTPS website delivery links.
- Academy: production progress schema aligned and sequential/graded progression enforced by `save_lesson_progress`.
- Support: automatic acknowledgement is sent only after the affiliate sends their first message.
