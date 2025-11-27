/**
 * Professional Email Signature Templates
 *
 * Each template has placeholders that will be replaced with user data:
 * {{fullName}}, {{title}}, {{company}}, {{department}}, {{pronouns}},
 * {{phone}}, {{mobile}}, {{email}}, {{website}}, {{address}},
 * {{photoUrl}}, {{logoUrl}}, {{accentColor}}
 */

// Template 1: Classic - Photo left, info center (like HubSpot style 1)
const classicTemplate = {
  id: 'classic',
  name: 'Clássico',
  description: 'Foto à esquerda com informações ao lado',
  hasPhoto: true,
  hasLogo: false,
  preview: `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333333;">
      <tr>
        <td style="vertical-align: top; padding-right: 20px;">
          <img src="{{photoUrl}}" alt="" width="100" height="100" style="border-radius: 50%; object-fit: cover;" />
        </td>
        <td style="vertical-align: top;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom: 8px;">
                <strong style="font-size: 18px; color: #1a1a1a;">{{fullName}}</strong>
              </td>
            </tr>
            <tr>
              <td style="color: #666666; padding-bottom: 2px;">{{title}}</td>
            </tr>
            <tr>
              <td style="color: #666666; padding-bottom: 2px;">{{department}} | {{company}}</td>
            </tr>
            <tr>
              <td style="color: #666666; padding-bottom: 12px;">{{pronouns}}</td>
            </tr>
            <tr>
              <td style="padding-bottom: 4px;">
                <span style="color: {{accentColor}};">📞</span> {{phone}} | {{mobile}}
              </td>
            </tr>
            <tr>
              <td style="padding-bottom: 4px;">
                <span style="color: {{accentColor}};">✉️</span> <a href="mailto:{{email}}" style="color: #333333; text-decoration: none;">{{email}}</a>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom: 4px;">
                <span style="color: {{accentColor}};">🌐</span> <a href="{{website}}" style="color: #333333; text-decoration: none;">{{website}}</a>
              </td>
            </tr>
            <tr>
              <td>
                <span style="color: {{accentColor}};">📍</span> {{address}}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `,
  html: (data) => `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333333;">
      <tr>
        ${data.photoUrl ? `
        <td style="vertical-align: top; padding-right: 20px;">
          <img src="${data.photoUrl}" alt="" width="100" height="100" style="border-radius: 50%; object-fit: cover;" />
        </td>
        ` : ''}
        <td style="vertical-align: top;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom: 8px;">
                <strong style="font-size: 18px; color: #1a1a1a;">${data.fullName || 'Seu Nome'}</strong>
              </td>
            </tr>
            ${data.title ? `<tr><td style="color: #666666; padding-bottom: 2px;">${data.title}</td></tr>` : ''}
            ${data.department || data.company ? `<tr><td style="color: #666666; padding-bottom: 2px;">${[data.department, data.company].filter(Boolean).join(' | ')}</td></tr>` : ''}
            ${data.pronouns ? `<tr><td style="color: #666666; padding-bottom: 12px;">${data.pronouns}</td></tr>` : ''}
            ${data.phone || data.mobile ? `<tr><td style="padding-bottom: 4px;"><span style="color: ${data.accentColor || '#ec4899'};">📞</span> ${[data.phone, data.mobile].filter(Boolean).join(' | ')}</td></tr>` : ''}
            ${data.email ? `<tr><td style="padding-bottom: 4px;"><span style="color: ${data.accentColor || '#ec4899'};">✉️</span> <a href="mailto:${data.email}" style="color: #333333; text-decoration: none;">${data.email}</a></td></tr>` : ''}
            ${data.website ? `<tr><td style="padding-bottom: 4px;"><span style="color: ${data.accentColor || '#ec4899'};">🌐</span> <a href="${data.website}" style="color: #333333; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a></td></tr>` : ''}
            ${data.address ? `<tr><td><span style="color: ${data.accentColor || '#ec4899'};">📍</span> ${data.address}</td></tr>` : ''}
          </table>
        </td>
      </tr>
    </table>
  `
};

// Template 2: Horizontal - Photo left, info center, contact right
const horizontalTemplate = {
  id: 'horizontal',
  name: 'Horizontal',
  description: 'Foto, informações e contatos em linha',
  hasPhoto: true,
  hasLogo: false,
  preview: `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #333333;">
      <tr>
        <td style="vertical-align: middle; padding-right: 15px;">
          <img src="{{photoUrl}}" alt="" width="80" height="80" style="border-radius: 50%; object-fit: cover;" />
        </td>
        <td style="vertical-align: middle; padding-right: 20px; border-right: 2px solid {{accentColor}};">
          <strong style="font-size: 16px; color: #1a1a1a;">{{fullName}}</strong><br>
          <span style="color: #666666;">{{title}}</span><br>
          <span style="color: #666666;">{{department}} | {{company}}</span><br>
          <span style="color: #888888; font-size: 12px;">{{pronouns}}</span>
        </td>
        <td style="vertical-align: middle; padding-left: 20px;">
          <span style="color: {{accentColor}};">📞</span> {{phone}}<br>
          <span style="color: {{accentColor}};">✉️</span> {{email}}<br>
          <span style="color: {{accentColor}};">🌐</span> {{website}}<br>
          <span style="color: {{accentColor}};">📍</span> {{address}}
        </td>
      </tr>
    </table>
  `,
  html: (data) => `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #333333;">
      <tr>
        ${data.photoUrl ? `
        <td style="vertical-align: middle; padding-right: 15px;">
          <img src="${data.photoUrl}" alt="" width="80" height="80" style="border-radius: 50%; object-fit: cover;" />
        </td>
        ` : ''}
        <td style="vertical-align: middle; padding-right: 20px; border-right: 2px solid ${data.accentColor || '#ec4899'};">
          <strong style="font-size: 16px; color: #1a1a1a;">${data.fullName || 'Seu Nome'}</strong><br>
          ${data.title ? `<span style="color: #666666;">${data.title}</span><br>` : ''}
          ${data.department || data.company ? `<span style="color: #666666;">${[data.department, data.company].filter(Boolean).join(' | ')}</span><br>` : ''}
          ${data.pronouns ? `<span style="color: #888888; font-size: 12px;">${data.pronouns}</span>` : ''}
        </td>
        <td style="vertical-align: middle; padding-left: 20px;">
          ${data.phone ? `<span style="color: ${data.accentColor || '#ec4899'};">📞</span> ${data.phone}<br>` : ''}
          ${data.email ? `<span style="color: ${data.accentColor || '#ec4899'};">✉️</span> <a href="mailto:${data.email}" style="color: #333333; text-decoration: none;">${data.email}</a><br>` : ''}
          ${data.website ? `<span style="color: ${data.accentColor || '#ec4899'};">🌐</span> <a href="${data.website}" style="color: #333333; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a><br>` : ''}
          ${data.address ? `<span style="color: ${data.accentColor || '#ec4899'};">📍</span> ${data.address}` : ''}
        </td>
      </tr>
    </table>
  `
};

// Template 3: With Logo - Photo top, info below with logo
const withLogoTemplate = {
  id: 'with-logo',
  name: 'Com Logo',
  description: 'Foto em cima, informações abaixo com logo da empresa',
  hasPhoto: true,
  hasLogo: true,
  preview: `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #333333; border-left: 4px solid {{accentColor}}; padding-left: 15px;">
      <tr>
        <td colspan="2" style="padding-bottom: 15px;">
          <img src="{{photoUrl}}" alt="" width="90" height="90" style="border-radius: 50%; object-fit: cover; border: 3px solid #f0f0f0;" />
        </td>
      </tr>
      <tr>
        <td style="vertical-align: top; padding-right: 30px;">
          <strong style="font-size: 16px; color: #1a1a1a;">{{fullName}}</strong><br>
          <span style="color: #666666;">{{title}}</span><br>
          <span style="color: #666666;">{{department}} | {{company}}</span><br>
          <span style="color: #888888; font-size: 12px;">{{pronouns}}</span>
        </td>
        <td style="vertical-align: top;">
          <span style="color: {{accentColor}};">📞</span> {{phone}}<br>
          <span style="color: {{accentColor}};">✉️</span> {{email}}<br>
          <span style="color: {{accentColor}};">🌐</span> {{website}}<br>
          <span style="color: {{accentColor}};">📍</span> {{address}}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding-top: 15px;">
          <img src="{{logoUrl}}" alt="Logo" height="40" style="max-width: 150px;" />
        </td>
      </tr>
    </table>
  `,
  html: (data) => `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #333333; border-left: 4px solid ${data.accentColor || '#22c55e'}; padding-left: 15px;">
      ${data.photoUrl ? `
      <tr>
        <td colspan="2" style="padding-bottom: 15px;">
          <img src="${data.photoUrl}" alt="" width="90" height="90" style="border-radius: 50%; object-fit: cover; border: 3px solid #f0f0f0;" />
        </td>
      </tr>
      ` : ''}
      <tr>
        <td style="vertical-align: top; padding-right: 30px;">
          <strong style="font-size: 16px; color: #1a1a1a;">${data.fullName || 'Seu Nome'}</strong><br>
          ${data.title ? `<span style="color: #666666;">${data.title}</span><br>` : ''}
          ${data.department || data.company ? `<span style="color: #666666;">${[data.department, data.company].filter(Boolean).join(' | ')}</span><br>` : ''}
          ${data.pronouns ? `<span style="color: #888888; font-size: 12px;">${data.pronouns}</span>` : ''}
        </td>
        <td style="vertical-align: top;">
          ${data.phone ? `<span style="color: ${data.accentColor || '#22c55e'};">📞</span> ${data.phone}<br>` : ''}
          ${data.email ? `<span style="color: ${data.accentColor || '#22c55e'};">✉️</span> <a href="mailto:${data.email}" style="color: #333333; text-decoration: none;">${data.email}</a><br>` : ''}
          ${data.website ? `<span style="color: ${data.accentColor || '#22c55e'};">🌐</span> <a href="${data.website}" style="color: #333333; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a><br>` : ''}
          ${data.address ? `<span style="color: ${data.accentColor || '#22c55e'};">📍</span> ${data.address}` : ''}
        </td>
      </tr>
      ${data.logoUrl ? `
      <tr>
        <td colspan="2" style="padding-top: 15px;">
          <img src="${data.logoUrl}" alt="Logo" height="40" style="max-width: 150px;" />
        </td>
      </tr>
      ` : ''}
    </table>
  `
};

// Template 4: Simple - Text only, no photo
const simpleTemplate = {
  id: 'simple',
  name: 'Simples',
  description: 'Apenas texto, sem imagens',
  hasPhoto: false,
  hasLogo: false,
  preview: `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333333;">
      <tr>
        <td>
          <strong style="font-size: 16px; color: #1a1a1a;">{{fullName}}</strong><br>
          <span style="color: #666666;">{{title}} | {{company}}</span>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 8px; border-top: 1px solid #e5e5e5; margin-top: 8px;">
          <span style="color: #666666;">{{phone}} | {{email}} | {{website}}</span>
        </td>
      </tr>
    </table>
  `,
  html: (data) => `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333333;">
      <tr>
        <td>
          <strong style="font-size: 16px; color: #1a1a1a;">${data.fullName || 'Seu Nome'}</strong><br>
          <span style="color: #666666;">${[data.title, data.company].filter(Boolean).join(' | ')}</span>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 8px; border-top: 1px solid #e5e5e5; margin-top: 8px;">
          <span style="color: #666666;">${[data.phone, data.email, data.website?.replace(/^https?:\/\//, '')].filter(Boolean).join(' | ')}</span>
        </td>
      </tr>
    </table>
  `
};

// Template 5: Modern Minimal - Clean with accent line
const modernMinimalTemplate = {
  id: 'modern-minimal',
  name: 'Moderno Minimal',
  description: 'Design limpo com linha de destaque',
  hasPhoto: false,
  hasLogo: true,
  preview: `
    <table cellpadding="0" cellspacing="0" style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #333333;">
      <tr>
        <td style="border-left: 3px solid {{accentColor}}; padding-left: 12px;">
          <strong style="font-size: 15px; color: #1a1a1a; letter-spacing: 0.5px;">{{fullName}}</strong><br>
          <span style="color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">{{title}}</span><br>
          <span style="color: {{accentColor}}; font-weight: 500;">{{company}}</span>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 12px; padding-left: 15px;">
          <span style="color: #666666;">{{email}}</span><br>
          <span style="color: #666666;">{{phone}}</span><br>
          <a href="{{website}}" style="color: {{accentColor}}; text-decoration: none;">{{website}}</a>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 12px; padding-left: 15px;">
          <img src="{{logoUrl}}" alt="Logo" height="30" style="opacity: 0.8;" />
        </td>
      </tr>
    </table>
  `,
  html: (data) => `
    <table cellpadding="0" cellspacing="0" style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #333333;">
      <tr>
        <td style="border-left: 3px solid ${data.accentColor || '#8b5cf6'}; padding-left: 12px;">
          <strong style="font-size: 15px; color: #1a1a1a; letter-spacing: 0.5px;">${data.fullName || 'Seu Nome'}</strong><br>
          ${data.title ? `<span style="color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">${data.title}</span><br>` : ''}
          ${data.company ? `<span style="color: ${data.accentColor || '#8b5cf6'}; font-weight: 500;">${data.company}</span>` : ''}
        </td>
      </tr>
      <tr>
        <td style="padding-top: 12px; padding-left: 15px;">
          ${data.email ? `<span style="color: #666666;">${data.email}</span><br>` : ''}
          ${data.phone ? `<span style="color: #666666;">${data.phone}</span><br>` : ''}
          ${data.website ? `<a href="${data.website}" style="color: ${data.accentColor || '#8b5cf6'}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a>` : ''}
        </td>
      </tr>
      ${data.logoUrl ? `
      <tr>
        <td style="padding-top: 12px; padding-left: 15px;">
          <img src="${data.logoUrl}" alt="Logo" height="30" style="opacity: 0.8;" />
        </td>
      </tr>
      ` : ''}
    </table>
  `
};

// Template 6: Corporate - Professional with logo header
const corporateTemplate = {
  id: 'corporate',
  name: 'Corporativo',
  description: 'Profissional com logo em destaque',
  hasPhoto: true,
  hasLogo: true,
  preview: `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #333333;">
      <tr>
        <td colspan="2" style="padding-bottom: 12px; border-bottom: 2px solid {{accentColor}};">
          <img src="{{logoUrl}}" alt="Logo" height="45" style="max-width: 180px;" />
        </td>
      </tr>
      <tr>
        <td style="vertical-align: top; padding-top: 12px; padding-right: 15px;">
          <img src="{{photoUrl}}" alt="" width="70" height="70" style="border-radius: 8px; object-fit: cover;" />
        </td>
        <td style="vertical-align: top; padding-top: 12px;">
          <strong style="font-size: 15px; color: #1a1a1a;">{{fullName}}</strong><br>
          <span style="color: {{accentColor}}; font-weight: 500;">{{title}}</span><br>
          <span style="color: #888888; font-size: 12px;">{{department}}</span><br><br>
          <span style="color: #666666; font-size: 12px;">
            📞 {{phone}}<br>
            ✉️ {{email}}<br>
            🌐 {{website}}
          </span>
        </td>
      </tr>
    </table>
  `,
  html: (data) => `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #333333;">
      ${data.logoUrl ? `
      <tr>
        <td colspan="2" style="padding-bottom: 12px; border-bottom: 2px solid ${data.accentColor || '#3b82f6'};">
          <img src="${data.logoUrl}" alt="Logo" height="45" style="max-width: 180px;" />
        </td>
      </tr>
      ` : ''}
      <tr>
        ${data.photoUrl ? `
        <td style="vertical-align: top; padding-top: 12px; padding-right: 15px;">
          <img src="${data.photoUrl}" alt="" width="70" height="70" style="border-radius: 8px; object-fit: cover;" />
        </td>
        ` : ''}
        <td style="vertical-align: top; padding-top: 12px;">
          <strong style="font-size: 15px; color: #1a1a1a;">${data.fullName || 'Seu Nome'}</strong><br>
          ${data.title ? `<span style="color: ${data.accentColor || '#3b82f6'}; font-weight: 500;">${data.title}</span><br>` : ''}
          ${data.department ? `<span style="color: #888888; font-size: 12px;">${data.department}</span><br>` : ''}
          <br>
          <span style="color: #666666; font-size: 12px;">
            ${data.phone ? `📞 ${data.phone}<br>` : ''}
            ${data.email ? `✉️ ${data.email}<br>` : ''}
            ${data.website ? `🌐 ${data.website.replace(/^https?:\/\//, '')}` : ''}
          </span>
        </td>
      </tr>
    </table>
  `
};

// Template 7: Bold Banner - Photo with colored background
const boldBannerTemplate = {
  id: 'bold-banner',
  name: 'Banner Colorido',
  description: 'Foto com fundo colorido moderno',
  hasPhoto: true,
  hasLogo: false,
  preview: `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px;">
      <tr>
        <td style="background: linear-gradient(135deg, {{accentColor}}, #667eea); padding: 15px; border-radius: 8px 8px 0 0;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right: 15px;">
                <img src="{{photoUrl}}" alt="" width="70" height="70" style="border-radius: 50%; border: 3px solid white; object-fit: cover;" />
              </td>
              <td style="vertical-align: middle;">
                <strong style="font-size: 16px; color: white;">{{fullName}}</strong><br>
                <span style="color: rgba(255,255,255,0.9); font-size: 13px;">{{title}}</span><br>
                <span style="color: rgba(255,255,255,0.8); font-size: 12px;">{{company}}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background: #f9fafb; padding: 12px 15px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
          <span style="color: #666666; font-size: 12px;">
            📞 {{phone}} &nbsp;&nbsp; ✉️ {{email}} &nbsp;&nbsp; 🌐 {{website}}
          </span>
        </td>
      </tr>
    </table>
  `,
  html: (data) => `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px;">
      <tr>
        <td style="background: linear-gradient(135deg, ${data.accentColor || '#8b5cf6'}, #667eea); padding: 15px; border-radius: 8px 8px 0 0;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              ${data.photoUrl ? `
              <td style="padding-right: 15px;">
                <img src="${data.photoUrl}" alt="" width="70" height="70" style="border-radius: 50%; border: 3px solid white; object-fit: cover;" />
              </td>
              ` : ''}
              <td style="vertical-align: middle;">
                <strong style="font-size: 16px; color: white;">${data.fullName || 'Seu Nome'}</strong><br>
                ${data.title ? `<span style="color: rgba(255,255,255,0.9); font-size: 13px;">${data.title}</span><br>` : ''}
                ${data.company ? `<span style="color: rgba(255,255,255,0.8); font-size: 12px;">${data.company}</span>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background: #f9fafb; padding: 12px 15px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
          <span style="color: #666666; font-size: 12px;">
            ${data.phone ? `📞 ${data.phone} &nbsp;&nbsp;` : ''}
            ${data.email ? `✉️ ${data.email} &nbsp;&nbsp;` : ''}
            ${data.website ? `🌐 ${data.website.replace(/^https?:\/\//, '')}` : ''}
          </span>
        </td>
      </tr>
    </table>
  `
};

// Template 8: Elegant Card - Clean card style
const elegantCardTemplate = {
  id: 'elegant-card',
  name: 'Cartão Elegante',
  description: 'Estilo cartão de visita clean',
  hasPhoto: true,
  hasLogo: true,
  preview: `
    <table cellpadding="0" cellspacing="0" style="font-family: 'Georgia', serif; font-size: 13px; color: #333333; border: 1px solid #e5e5e5; border-radius: 4px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; background: white;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="vertical-align: top; width: 80px;">
                <img src="{{photoUrl}}" alt="" width="70" height="70" style="border-radius: 4px; object-fit: cover;" />
              </td>
              <td style="vertical-align: top; padding-left: 15px;">
                <strong style="font-size: 17px; color: #1a1a1a; font-family: 'Georgia', serif;">{{fullName}}</strong><br>
                <span style="color: #888888; font-style: italic; font-size: 12px;">{{title}}</span><br>
                <span style="color: {{accentColor}}; font-size: 13px;">{{company}}</span>
              </td>
              <td style="vertical-align: top; text-align: right;">
                <img src="{{logoUrl}}" alt="Logo" height="35" />
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 20px; background: #fafafa; border-top: 1px solid #e5e5e5;">
          <span style="color: #666666; font-size: 12px; font-family: Arial, sans-serif;">
            {{phone}} · {{email}} · {{website}}
          </span>
        </td>
      </tr>
    </table>
  `,
  html: (data) => `
    <table cellpadding="0" cellspacing="0" style="font-family: 'Georgia', serif; font-size: 13px; color: #333333; border: 1px solid #e5e5e5; border-radius: 4px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; background: white;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              ${data.photoUrl ? `
              <td style="vertical-align: top; width: 80px;">
                <img src="${data.photoUrl}" alt="" width="70" height="70" style="border-radius: 4px; object-fit: cover;" />
              </td>
              ` : ''}
              <td style="vertical-align: top; padding-left: ${data.photoUrl ? '15px' : '0'};">
                <strong style="font-size: 17px; color: #1a1a1a; font-family: 'Georgia', serif;">${data.fullName || 'Seu Nome'}</strong><br>
                ${data.title ? `<span style="color: #888888; font-style: italic; font-size: 12px;">${data.title}</span><br>` : ''}
                ${data.company ? `<span style="color: ${data.accentColor || '#b45309'}; font-size: 13px;">${data.company}</span>` : ''}
              </td>
              ${data.logoUrl ? `
              <td style="vertical-align: top; text-align: right;">
                <img src="${data.logoUrl}" alt="Logo" height="35" />
              </td>
              ` : ''}
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 20px; background: #fafafa; border-top: 1px solid #e5e5e5;">
          <span style="color: #666666; font-size: 12px; font-family: Arial, sans-serif;">
            ${[data.phone, data.email, data.website?.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ')}
          </span>
        </td>
      </tr>
    </table>
  `
};

// Template 9: Tech Startup - Modern with icons
const techStartupTemplate = {
  id: 'tech-startup',
  name: 'Tech Startup',
  description: 'Moderno com ícones estilizados',
  hasPhoto: true,
  hasLogo: true,
  preview: `
    <table cellpadding="0" cellspacing="0" style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #333333;">
      <tr>
        <td style="vertical-align: top;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right: 15px;">
                <img src="{{photoUrl}}" alt="" width="85" height="85" style="border-radius: 12px; object-fit: cover;" />
              </td>
              <td style="vertical-align: top;">
                <img src="{{logoUrl}}" alt="" height="22" style="margin-bottom: 8px;" /><br>
                <strong style="font-size: 16px; color: #1a1a1a;">{{fullName}}</strong><br>
                <span style="color: {{accentColor}}; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">{{title}}</span><br>
                <span style="color: #888888; font-size: 12px;">{{department}}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 12px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right: 20px;">
                <span style="display: inline-block; width: 24px; height: 24px; background: {{accentColor}}; border-radius: 6px; text-align: center; line-height: 24px; color: white; font-size: 12px;">📞</span>
                <span style="color: #666666; font-size: 12px; margin-left: 6px;">{{phone}}</span>
              </td>
              <td style="padding-right: 20px;">
                <span style="display: inline-block; width: 24px; height: 24px; background: {{accentColor}}; border-radius: 6px; text-align: center; line-height: 24px; color: white; font-size: 12px;">✉️</span>
                <span style="color: #666666; font-size: 12px; margin-left: 6px;">{{email}}</span>
              </td>
              <td>
                <span style="display: inline-block; width: 24px; height: 24px; background: {{accentColor}}; border-radius: 6px; text-align: center; line-height: 24px; color: white; font-size: 12px;">🌐</span>
                <span style="color: #666666; font-size: 12px; margin-left: 6px;">{{website}}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `,
  html: (data) => `
    <table cellpadding="0" cellspacing="0" style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #333333;">
      <tr>
        <td style="vertical-align: top;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              ${data.photoUrl ? `
              <td style="padding-right: 15px;">
                <img src="${data.photoUrl}" alt="" width="85" height="85" style="border-radius: 12px; object-fit: cover;" />
              </td>
              ` : ''}
              <td style="vertical-align: top;">
                ${data.logoUrl ? `<img src="${data.logoUrl}" alt="" height="22" style="margin-bottom: 8px;" /><br>` : ''}
                <strong style="font-size: 16px; color: #1a1a1a;">${data.fullName || 'Seu Nome'}</strong><br>
                ${data.title ? `<span style="color: ${data.accentColor || '#06b6d4'}; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${data.title}</span><br>` : ''}
                ${data.department ? `<span style="color: #888888; font-size: 12px;">${data.department}</span>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 12px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              ${data.phone ? `
              <td style="padding-right: 20px;">
                <span style="display: inline-block; width: 24px; height: 24px; background: ${data.accentColor || '#06b6d4'}; border-radius: 6px; text-align: center; line-height: 24px; color: white; font-size: 12px;">📞</span>
                <span style="color: #666666; font-size: 12px; margin-left: 6px;">${data.phone}</span>
              </td>
              ` : ''}
              ${data.email ? `
              <td style="padding-right: 20px;">
                <span style="display: inline-block; width: 24px; height: 24px; background: ${data.accentColor || '#06b6d4'}; border-radius: 6px; text-align: center; line-height: 24px; color: white; font-size: 12px;">✉️</span>
                <span style="color: #666666; font-size: 12px; margin-left: 6px;">${data.email}</span>
              </td>
              ` : ''}
              ${data.website ? `
              <td>
                <span style="display: inline-block; width: 24px; height: 24px; background: ${data.accentColor || '#06b6d4'}; border-radius: 6px; text-align: center; line-height: 24px; color: white; font-size: 12px;">🌐</span>
                <span style="color: #666666; font-size: 12px; margin-left: 6px;">${data.website.replace(/^https?:\/\//, '')}</span>
              </td>
              ` : ''}
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
};

// Template 10: Only Logo - Company branding only
const onlyLogoTemplate = {
  id: 'only-logo',
  name: 'Só Logo',
  description: 'Focado na marca da empresa',
  hasPhoto: false,
  hasLogo: true,
  preview: `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #333333;">
      <tr>
        <td style="padding-bottom: 10px;">
          <img src="{{logoUrl}}" alt="Logo" height="50" style="max-width: 200px;" />
        </td>
      </tr>
      <tr>
        <td style="border-top: 2px solid {{accentColor}}; padding-top: 10px;">
          <strong style="font-size: 15px; color: #1a1a1a;">{{fullName}}</strong>
          <span style="color: #888888;"> · </span>
          <span style="color: {{accentColor}};">{{title}}</span><br>
          <span style="color: #666666; font-size: 12px;">{{phone}} · {{email}} · {{website}}</span>
        </td>
      </tr>
    </table>
  `,
  html: (data) => `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 13px; color: #333333;">
      ${data.logoUrl ? `
      <tr>
        <td style="padding-bottom: 10px;">
          <img src="${data.logoUrl}" alt="Logo" height="50" style="max-width: 200px;" />
        </td>
      </tr>
      ` : ''}
      <tr>
        <td style="border-top: 2px solid ${data.accentColor || '#f59e0b'}; padding-top: 10px;">
          <strong style="font-size: 15px; color: #1a1a1a;">${data.fullName || 'Seu Nome'}</strong>
          ${data.title ? `<span style="color: #888888;"> · </span><span style="color: ${data.accentColor || '#f59e0b'};">${data.title}</span>` : ''}
          <br>
          <span style="color: #666666; font-size: 12px;">${[data.phone, data.email, data.website?.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ')}</span>
        </td>
      </tr>
    </table>
  `
};

// Export all templates
export const signatureTemplates = [
  classicTemplate,
  horizontalTemplate,
  withLogoTemplate,
  simpleTemplate,
  modernMinimalTemplate,
  corporateTemplate,
  boldBannerTemplate,
  elegantCardTemplate,
  techStartupTemplate,
  onlyLogoTemplate
];

// Default accent colors for each template
export const defaultAccentColors = {
  'classic': '#ec4899',
  'horizontal': '#ec4899',
  'with-logo': '#22c55e',
  'simple': '#6b7280',
  'modern-minimal': '#8b5cf6',
  'corporate': '#3b82f6',
  'bold-banner': '#8b5cf6',
  'elegant-card': '#b45309',
  'tech-startup': '#06b6d4',
  'only-logo': '#f59e0b'
};

// Placeholder image for preview
export const placeholderPhoto = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e5e7eb"/%3E%3Cpath d="M50 30a15 15 0 110 30 15 15 0 010-30zm0 40c16.569 0 30 8.059 30 18v7H20v-7c0-9.941 13.431-18 30-18z" fill="%239ca3af"/%3E%3C/svg%3E';

export const placeholderLogo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40"%3E%3Crect width="150" height="40" fill="%23e5e7eb"/%3E%3Ctext x="75" y="25" font-family="Arial" font-size="14" fill="%239ca3af" text-anchor="middle"%3ELogo%3C/text%3E%3C/svg%3E';

// Helper function to generate preview HTML with sample data
export const generatePreview = (template, accentColor) => {
  const sampleData = {
    fullName: 'João Silva',
    title: 'Gerente de Marketing',
    department: 'Marketing',
    company: 'Empresa ABC',
    pronouns: 'Ele/Dele',
    phone: '+55 11 99999-9999',
    mobile: '+55 11 98888-8888',
    email: 'joao@empresa.com',
    website: 'https://www.empresa.com',
    address: 'São Paulo, SP',
    photoUrl: placeholderPhoto,
    logoUrl: placeholderLogo,
    accentColor: accentColor || defaultAccentColors[template.id]
  };

  return template.html(sampleData);
};

export default signatureTemplates;
