/*
  One contact-form message, as shown in Admin · Messages (beside the list on
  desktop) and Admin · Message (its own page on tablet and phones). Reply by
  Email opens the admin's own email app (a mailto link): the website never
  sends the reply. Mark as Handled moves it out of New; Delete asks first.
*/
import { api } from './api';
import { badge, confirmAction, el, formatDateTime } from './admin';
import envelopeOpen from '../assets/icons/admin/envelope-open-plum.svg';
import trash from '../assets/icons/admin/trash-red.svg';

export interface AdminMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'handled';
  createdAt: string;
}

export const messageBadge = (m: AdminMessage) =>
  m.status === 'new' ? badge('New', 'warning') : badge('Handled', 'neutral');

// Encode each part of the address, so characters such as ? or & in an
// address cannot add extra fields to the email.
const mailto = (m: AdminMessage) => {
  const [local, domain] = m.email.split('@');
  const subject = m.subject ? `Re: ${m.subject}` : 'Your message to OMWI';
  return `mailto:${encodeURIComponent(local)}@${encodeURIComponent(domain)}?subject=${encodeURIComponent(subject)}`;
};

const icon = (src: string) => {
  const img = el('img');
  img.src = src;
  img.width = 20;
  img.height = 20;
  img.alt = '';
  return img;
};

interface Handlers {
  /** The message changed (status); redraw what depends on it. */
  onChange: (m: AdminMessage) => void;
  onDeleted: (m: AdminMessage) => void;
  onError: (text: string) => void;
}

/**
 * The message: sender line, sent date and badge, the text, the reply note,
 * and the buttons. `withSubject` adds the subject as a heading (desktop
 * reader); the Message page shows it as the page title instead.
 */
export function renderMessage(m: AdminMessage, handlers: Handlers, { withSubject = false } = {}): HTMLElement {
  const box = el('div', 'admin-message');

  const head = el('div', 'admin-message__head');
  const who = el('div', 'admin-message__who');
  if (withSubject) who.append(el('h2', 't-h4', m.subject || '(no subject)'));
  who.append(el('p', 't-body', `${m.name} · ${m.email}`));
  who.append(el('p', 't-body-small admin-muted', `Sent ${formatDateTime(m.createdAt)} through the contact form`));
  head.append(who, messageBadge(m));

  const text = el('p', 't-body admin-message__text', m.message);

  const note = el('p', 'admin-notice t-body-small');
  note.append(
    icon(envelopeOpen.src),
    el('span', '', `Reply by Email opens your email app with a reply to ${m.email}. The reply comes from your own email account, not from the website.`),
  );

  const actions = el('div', 'admin-message__actions');
  const reply = el('a', 'btn btn--primary t-button admin-message__button', 'Reply by Email');
  reply.href = mailto(m);
  const toggle = el('button', 'btn btn--outline t-button admin-message__button', m.status === 'new' ? 'Mark as Handled' : 'Mark as New');
  toggle.type = 'button';
  toggle.addEventListener('click', async () => {
    toggle.disabled = true;
    try {
      const { message } = await api<{ message: AdminMessage }>(`/admin/messages/${encodeURIComponent(m.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ handled: m.status === 'new' }),
      });
      handlers.onChange(message);
    } catch {
      handlers.onError('The change was not saved. Please try again.');
      toggle.disabled = false;
    }
  });
  actions.append(reply, toggle);

  const remove = el('button', 'admin-message__delete t-button');
  remove.type = 'button';
  remove.append(icon(trash.src), document.createTextNode('Delete message'));
  remove.addEventListener('click', async () => {
    const ok = await confirmAction({
      title: 'Delete this message?',
      text: `The message from ${m.name} will be removed for good. This can't be undone.`,
      confirmLabel: 'Delete Message',
    });
    if (!ok) return;
    try {
      await api(`/admin/messages/${encodeURIComponent(m.id)}`, { method: 'DELETE' });
      handlers.onDeleted(m);
    } catch {
      handlers.onError('The message was not deleted. Please try again.');
    }
  });

  box.append(head, el('hr', 'admin-message__rule'), text, note, actions, remove);
  return box;
}
