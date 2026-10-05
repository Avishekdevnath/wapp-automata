import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessage, classifyChatType } from '../../src/normalizer';
import {
  mockTextMessageEvent,
  mockExtendedTextMessageEvent,
  mockImageWithCaptionEvent,
  mockMediaWithoutCaptionEvent,
  mockEphemeralWrappedEvent,
  mockMalformedEvent
} from '../fixtures/messages';

describe('Phase 4 Message Normalizer Tests', () => {
  it('should correctly classify chat types by JID suffix', () => {
    assert.equal(classifyChatType('120363025512345678@g.us'), 'group');
    assert.equal(classifyChatType('447700900123@s.whatsapp.net'), 'individual');
    assert.equal(classifyChatType('120363025599999999@newsletter'), 'channel');
    assert.equal(classifyChatType('unknown-format-jid'), 'unknown');
  });

  it('should normalize standard conversation text message', () => {
    const envelope = normalizeMessage(mockTextMessageEvent);

    assert.ok(envelope !== null);
    assert.equal(envelope.id, '3EB04F18B92A76C1');
    assert.equal(envelope.chatId, '120363025512345678@g.us');
    assert.equal(envelope.chatType, 'group');
    assert.equal(envelope.senderId, '447700900123@s.whatsapp.net');
    assert.equal(envelope.senderName, 'David Miller');
    assert.equal(envelope.timestamp, 1727915100);
    assert.equal(envelope.text, 'Grade A Wheat: $240/MT FOB. Minimum order 500 MT.');
    assert.equal(envelope.hasMedia, false);
    assert.equal(envelope.media, null);
    assert.equal(envelope.replyTo, null);
    assert.deepEqual(envelope.rawPayload, mockTextMessageEvent);
  });

  it('should normalize extended text message with quoted reply reference', () => {
    const envelope = normalizeMessage(mockExtendedTextMessageEvent);

    assert.ok(envelope !== null);
    assert.equal(envelope.id, '3EB09911FF246802');
    assert.equal(envelope.chatId, '120363025512345678@g.us');
    assert.equal(envelope.chatType, 'group');
    assert.equal(envelope.senderId, '447700900456@s.whatsapp.net');
    assert.equal(envelope.senderName, 'Buyer Sarah');
    assert.equal(envelope.text, 'We will take 1,000 MT at this price.');
    assert.equal(envelope.hasMedia, false);
    assert.equal(envelope.media, null);

    assert.ok(envelope.replyTo !== null);
    assert.equal(envelope.replyTo.messageId, '3EB04F18B92A76C1');
    assert.equal(envelope.replyTo.senderId, '447700900123@s.whatsapp.net');
    assert.equal(envelope.replyTo.quotedText, 'Grade A Wheat: $240/MT FOB. Minimum order 500 MT.');
  });

  it('should normalize media message with caption', () => {
    const envelope = normalizeMessage(mockImageWithCaptionEvent);

    assert.ok(envelope !== null);
    assert.equal(envelope.id, '3EB088C32E9041A9');
    assert.equal(envelope.text, 'Inspection certificate attached.');
    assert.equal(envelope.hasMedia, true);

    assert.ok(envelope.media !== null);
    assert.equal(envelope.media.type, 'image');
    assert.equal(envelope.media.mimetype, 'image/jpeg');
    assert.equal(envelope.media.fileSize, 248910);
    assert.equal(envelope.media.fileName, null);
  });

  it('should normalize media message without caption as empty string text', () => {
    const envelope = normalizeMessage(mockMediaWithoutCaptionEvent);

    assert.ok(envelope !== null);
    assert.equal(envelope.id, '3EB0112233445566');
    assert.equal(envelope.chatId, '447700900123@s.whatsapp.net');
    assert.equal(envelope.chatType, 'individual');
    assert.equal(envelope.text, '');
    assert.equal(envelope.hasMedia, true);

    assert.ok(envelope.media !== null);
    assert.equal(envelope.media.type, 'document');
    assert.equal(envelope.media.mimetype, 'application/pdf');
    assert.equal(envelope.media.fileName, 'price_catalog_oct2026.pdf');
    assert.equal(envelope.media.fileSize, 1048576);
  });

  it('should unwrap ephemeral wrapped message transparently', () => {
    const envelope = normalizeMessage(mockEphemeralWrappedEvent);

    assert.ok(envelope !== null);
    assert.equal(envelope.id, '3EB0778899AABBCC');
    assert.equal(envelope.text, 'Ephemeral announcement: Market closes at 4 PM.');
    assert.equal(envelope.senderName, 'Admin Alice');
  });

  it('should return null for malformed events lacking ID or remoteJid', () => {
    assert.equal(normalizeMessage(mockMalformedEvent), null);
    assert.equal(normalizeMessage(null), null);
    assert.equal(normalizeMessage(undefined), null);
    assert.equal(normalizeMessage('not-an-object'), null);
  });

  it('should preserve verbatim text without parsing prices, currency, or altering formatting', () => {
    const rawComplexText = '   Special Price: €120/ton!   \n   Includes 5% tax.   \t   ';
    const event = {
      key: { id: 'wamid_verbatim', remoteJid: 'test@s.whatsapp.net' },
      message: { conversation: rawComplexText },
      messageTimestamp: 1727915500
    };

    const envelope = normalizeMessage(event);
    assert.ok(envelope !== null);
    // Verbatim guarantee: exact characters including whitespace, tabs, and newlines
    assert.equal(envelope.text, rawComplexText);
    // Boundary check: no prices extracted as separate fields
    assert.equal((envelope as unknown as Record<string, unknown>).price, undefined);
    assert.equal((envelope as unknown as Record<string, unknown>).currency, undefined);
  });

  it('should return null for WhatsApp internal protocol messages and empty events', () => {
    // Protocol message: HISTORY_SYNC_NOTIFICATION
    const historySyncEvent = {
      key: { id: 'SYNC_123', remoteJid: '233328510783593@lid' },
      message: {
        protocolMessage: {
          type: 'HISTORY_SYNC_NOTIFICATION',
          historySyncNotification: { fileSha256: 'abc...' }
        }
      },
      messageTimestamp: 1727915600
    };
    assert.equal(normalizeMessage(historySyncEvent), null);

    // Protocol message: senderKeyDistributionMessage
    const keyDistEvent = {
      key: { id: 'KEY_123', remoteJid: '120363025512345678@g.us' },
      message: {
        senderKeyDistributionMessage: { groupId: '120363025512345678@g.us' }
      },
      messageTimestamp: 1727915600
    };
    assert.equal(normalizeMessage(keyDistEvent), null);

    // Empty event with no message content
    const emptyEvent = {
      key: { id: 'EMPTY_123', remoteJid: '447700900123@s.whatsapp.net' },
      message: {},
      messageTimestamp: 1727915600
    };
    assert.equal(normalizeMessage(emptyEvent), null);
  });

  it('should normalize contact cards (vCards) with display name and phone number', () => {
    const vCardEvent = {
      key: { id: 'VCARD_123', remoteJid: '120363025512345678@g.us', participant: '447700900123@s.whatsapp.net' },
      isArchived: true,
      message: {
        contactMessage: {
          displayName: 'John Telecom Broker',
          vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:John Telecom Broker\nTEL;waid=14155552671:+1 415 555 2671\nEND:VCARD'
        }
      },
      messageTimestamp: 1727915700
    };

    const envelope = normalizeMessage(vCardEvent);
    assert.ok(envelope !== null);
    assert.equal(envelope.hasMedia, true);
    assert.equal(envelope.media?.type, 'contact');
    assert.equal(envelope.isArchived, true);
    assert.ok(envelope.contact !== null);
    assert.equal(envelope.contact?.name, 'John Telecom Broker');
    assert.equal(envelope.contact?.phone, '+14155552671');
  });

  it('should normalize location messages with latitude, longitude and label', () => {
    const locEvent = {
      key: { id: 'LOC_123', remoteJid: '447700900123@s.whatsapp.net' },
      message: {
        locationMessage: {
          degreesLatitude: 23.8103,
          degreesLongitude: 90.4125,
          name: 'Dhaka Datacenter',
          address: 'Motijheel, Dhaka'
        }
      },
      messageTimestamp: 1727915800
    };

    const envelope = normalizeMessage(locEvent);
    assert.ok(envelope !== null);
    assert.equal(envelope.hasMedia, true);
    assert.equal(envelope.media?.type, 'location');
    assert.ok(envelope.location !== null);
    assert.equal(envelope.location?.latitude, 23.8103);
    assert.equal(envelope.location?.longitude, 90.4125);
    assert.equal(envelope.location?.name, 'Dhaka Datacenter');
  });

  it('should normalize voice notes with duration and voiceNote flag', () => {
    const pttEvent = {
      key: { id: 'AUDIO_123', remoteJid: '447700900123@s.whatsapp.net', fromMe: true },
      message: {
        audioMessage: {
          mimetype: 'audio/ogg; codecs=opus',
          seconds: 42,
          ptt: true
        }
      },
      messageTimestamp: 1727915900
    };

    const envelope = normalizeMessage(pttEvent);
    assert.ok(envelope !== null);
    assert.equal(envelope.hasMedia, true);
    assert.equal(envelope.media?.type, 'audio');
    assert.equal(envelope.media?.isVoiceNote, true);
    assert.equal(envelope.media?.durationSeconds, 42);
    assert.equal(envelope.isFromMe, true);
  });
});

