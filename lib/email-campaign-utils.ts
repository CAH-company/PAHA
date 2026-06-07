export type SendWindow = {
  days: number[];   // 0=Ndz, 1=Pon, 2=Wt, 3=Śr, 4=Czw, 5=Pt, 6=Sob
  from: string;     // "HH:MM"
  to: string;       // "HH:MM"
  tz: string;       // IANA timezone, e.g. "Europe/Warsaw"
} | null;

export function isInWindow(win: SendWindow, now: Date): boolean {
  if (!win || !win.days?.length) return true;

  const tz = win.tz || 'Europe/Warsaw';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
  const day = dayMap[weekday] ?? -1;

  const h = parts.find(p => p.type === 'hour')?.value   ?? '00';
  const m = parts.find(p => p.type === 'minute')?.value ?? '00';
  const time = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;

  return win.days.includes(day) && time >= win.from && time < win.to;
}

export function applyVars(
  template: string,
  lead: { name?: string; company?: string; email?: string },
) {
  const firstName = (lead.name ?? '').split(' ')[0];
  return template
    .replace(/\{\{name\}\}/g, lead.name ?? '')
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{company\}\}/g, lead.company ?? '')
    .replace(/\{\{email\}\}/g, lead.email ?? '');
}

export function buildHtml(
  body: string,
  recipientId: string,
  appUrl: string,
) {
  const base = appUrl.replace(/\/$/, '');
  const pixel    = `<img src="${base}/api/email-campaigns/track?type=open&rid=${recipientId}" width="1" height="1" alt="" style="display:none" />`;
  const replyUrl = `${base}/api/email-campaigns/track?type=reply&rid=${recipientId}`;
  const unsubUrl = `${base}/api/email-campaigns/unsubscribe?rid=${recipientId}`;

  const footer = `
<br><br>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
<p style="font-size:12px;color:#94a3b8;margin:0">
  <a href="${replyUrl}" style="color:#6366f1;text-decoration:none">Odpowiedz na tego emaila</a>
  &nbsp;·&nbsp;
  <a href="${unsubUrl}" style="color:#94a3b8;text-decoration:none">Wypisz mnie z tej listy</a>
</p>
${pixel}`;

  return body.replace(/\n/g, '<br>') + footer;
}
