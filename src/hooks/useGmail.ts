import { useState, useEffect } from 'react';
import { getAccessToken, googleSignIn } from '../store/firebase';

export function useGmail() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      let token = await getAccessToken();
      if (!token) {
        const result = await googleSignIn();
        token = result?.accessToken || null;
      }

      if (!token) throw new Error('No access token available');

      // Fetch list of messages
      const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const listData = await listRes.json();
      
      if (!listData.messages) {
        setMessages([]);
        return;
      }

      // Fetch full message details for each
      const detailedMessages = await Promise.all(
        listData.messages.map(async (msg: any) => {
          const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          return await detailRes.json();
        })
      );

      // Parse headers for easy access
      const parsedMessages = detailedMessages.map(msg => {
        const headers = msg.payload.headers;
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
        const date = headers.find((h: any) => h.name === 'Date')?.value || '';
        return { ...msg, subject, from, date };
      });

      setMessages(parsedMessages);
    } catch (err: any) {
      console.error('Error fetching Gmail:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async (to: string, subject: string, body: string) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token available');

      const emailLines = [
        `To: ${to}`,
        'Content-type: text/html;charset=iso-8859-1',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        body
      ];

      const email = emailLines.join('\r\n').trim();
      const encodedEmail = btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: encodedEmail })
      });

      if (!res.ok) throw new Error('Failed to send email');
      return await res.json();
    } catch (err: any) {
      console.error('Error sending email:', err);
      throw err;
    }
  };

  return { messages, loading, error, fetchMessages, sendEmail };
}
