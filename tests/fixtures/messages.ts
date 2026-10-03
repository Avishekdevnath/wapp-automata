/**
 * Realistic Sanitized WhatsApp Event Fixtures
 */

export const mockTextMessageEvent = {
  key: {
    remoteJid: '120363025512345678@g.us',
    fromMe: false,
    id: '3EB04F18B92A76C1',
    participant: '447700900123@s.whatsapp.net'
  },
  message: {
    conversation: 'Grade A Wheat: $240/MT FOB. Minimum order 500 MT.'
  },
  messageTimestamp: 1727915100,
  pushName: 'David Miller'
};

export const mockExtendedTextMessageEvent = {
  key: {
    remoteJid: '120363025512345678@g.us',
    fromMe: false,
    id: '3EB09911FF246802',
    participant: '447700900456@s.whatsapp.net'
  },
  message: {
    extendedTextMessage: {
      text: 'We will take 1,000 MT at this price.',
      contextInfo: {
        stanzaId: '3EB04F18B92A76C1',
        participant: '447700900123@s.whatsapp.net',
        quotedMessage: {
          conversation: 'Grade A Wheat: $240/MT FOB. Minimum order 500 MT.'
        }
      }
    }
  },
  messageTimestamp: 1727915220,
  pushName: 'Buyer Sarah'
};

export const mockImageWithCaptionEvent = {
  key: {
    remoteJid: '120363025512345678@g.us',
    fromMe: false,
    id: '3EB088C32E9041A9',
    participant: '447700900123@s.whatsapp.net'
  },
  message: {
    imageMessage: {
      url: 'https://mmg.whatsapp.net/d/f/...',
      mimetype: 'image/jpeg',
      caption: 'Inspection certificate attached.',
      fileLength: 248910
    }
  },
  messageTimestamp: 1727915170,
  pushName: 'David Miller'
};

export const mockMediaWithoutCaptionEvent = {
  key: {
    remoteJid: '447700900123@s.whatsapp.net',
    fromMe: false,
    id: '3EB0112233445566'
  },
  message: {
    documentMessage: {
      url: 'https://mmg.whatsapp.net/d/f/...',
      mimetype: 'application/pdf',
      fileName: 'price_catalog_oct2026.pdf',
      fileLength: 1048576
    }
  },
  messageTimestamp: 1727915300
};

export const mockEphemeralWrappedEvent = {
  key: {
    remoteJid: '120363025512345678@g.us',
    fromMe: false,
    id: '3EB0778899AABBCC',
    participant: '447700900789@s.whatsapp.net'
  },
  message: {
    ephemeralMessage: {
      message: {
        conversation: 'Ephemeral announcement: Market closes at 4 PM.'
      }
    }
  },
  messageTimestamp: 1727915400,
  pushName: 'Admin Alice'
};

export const mockMalformedEvent = {
  key: {
    // Missing id and remoteJid
  },
  message: {
    conversation: 'Orphaned message'
  }
};
