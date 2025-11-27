# Email Channel

Email is essential for professional outreach. GetRaze provides comprehensive email settings including branding, signatures, and templates.

## Accessing Email Settings

Navigate to **Emails** → **Email Settings** in the sidebar.

The settings page has four tabs:
1. [Branding](#branding) - Company logo and format preferences
2. [Signatures](#signatures) - Email signatures
3. [Templates](#templates) - Reusable email templates
4. [Preferences](#preferences) - Default settings

## Branding

Configure how your emails look and feel.

### Company Logo

Upload your company logo to appear in emails:

1. Click the upload area or drag a file
2. Supported formats: PNG, JPG, GIF, WebP, SVG
3. Maximum size: 5MB
4. Recommended: 200x200px or larger

### Format Preference

| Option | Description |
|--------|-------------|
| HTML | Rich formatting with images and styling |
| Plain Text | Simple text without formatting |

### Logo Settings

| Setting | Description |
|---------|-------------|
| Include Logo | Toggle to show/hide logo in emails |
| Logo Position | Where the logo appears |

## Signatures

Create professional email signatures for your outreach.

### Creating a Signature

1. Go to the **Signatures** tab
2. Click **Create Signature**
3. Fill in the form

### Signature Fields

**Required:**
| Field | Description |
|-------|-------------|
| Signature Name | Internal name to identify this signature |
| Full Name | Your name as it appears in emails |

**Optional:**
| Field | Description |
|-------|-------------|
| Job Title | Your role/position |
| Department | Your department/team |
| Company Name | Company name |
| Pronouns | Your pronouns (he/him, she/her, etc.) |
| Phone | Office/landline number |
| Mobile | Mobile/cell number |
| Email | Email address to display |
| Website | Company website URL |
| Address | Office address |
| Photo | Your profile photo (circular, max 2MB) |
| Company Logo | Company logo for signature (max 2MB) |

### Signature Templates

Choose from pre-designed templates:

| Template Style | Best For |
|---------------|----------|
| Photo-based | Personal touch, relationship building |
| Logo-based | Corporate branding, formal communication |
| Text-only | Simple, fast-loading, universal |

### Accent Colors

Customize your signature with colors:
- Pink, Purple, Blue, Cyan
- Green, Orange, Red
- Gray, Black

### Managing Signatures

**Set as Default:**
1. Click the star icon on a signature
2. This signature will be used by default

**Edit Signature:**
1. Click the edit icon
2. Modify fields
3. Save changes

**Delete Signature:**
1. Click the delete icon
2. Confirm deletion

::: warning
You cannot delete your default signature. Set another as default first.
:::

## Templates

Create reusable email templates for campaigns.

### Creating a Template

1. Go to the **Templates** tab
2. Click **Create Template**
3. Fill in the form

### Template Fields

| Field | Required | Description |
|-------|----------|-------------|
| Template Name | Yes | Internal name |
| Category | Yes | Template category |
| Description | No | What this template is for |
| Subject Line | No | Email subject (supports variables) |
| Content | Yes | Email body (HTML editor) |

### Template Categories

| Category | Use Case |
|----------|----------|
| Outreach | Initial contact with prospects |
| Follow-up | Follow-up messages |
| Meeting | Meeting requests and confirmations |
| Thank You | Appreciation messages |
| Custom | Other purposes |

### Using Variables

Personalize templates with variables:

| Variable | Description |
|----------|-------------|
| `{{name}}` | Recipient's name |
| `{{company}}` | Company name |
| `{{title}}` | Job title |
| `{{industry}}` | Industry |

**Example Subject:**
```
Quick question for {{name}} at {{company}}
```

**Example Body:**
```html
Hi {{name}},

I noticed that {{company}} is growing in the {{industry}} space.
We've helped similar companies increase their lead generation by 3x.

Would you be open to a quick call this week?

Best regards
```

### Template Editor

The rich text editor supports:
- **Bold**, *italic*, underline
- Bullet and numbered lists
- Links
- Variable insertion buttons
- Preview mode

### Managing Templates

**Duplicate Template:**
1. Click the copy icon
2. Edit the copy as needed
3. Save with new name

**Edit Template:**
1. Click the edit icon
2. Modify content
3. Save changes

**Delete Template:**
1. Click the delete icon
2. Confirm deletion

## Preferences

Set your default email behavior.

### Default Signature

Select which signature to use when none is specified:
1. Open the Preferences tab
2. Select from the dropdown
3. Save changes

### Email Format Preference

| Option | Description |
|--------|-------------|
| Account Default | Use your connected email account's setting |
| HTML | Always use HTML formatting |
| Plain Text | Always use plain text |

### Use Account Signature

| Setting | Behavior |
|---------|----------|
| On | Use signature from your email provider |
| Off | Use GetRaze signatures only |

## Email Best Practices

### Subject Lines
- Keep under 50 characters
- Be specific and relevant
- Avoid spam trigger words
- Use personalization

### Email Body
- Keep paragraphs short
- Focus on one main point
- Include a clear call-to-action
- Personalize with variables

### Formatting
- Use HTML for visual emails
- Use plain text for simplicity
- Test on multiple email clients
- Include text version for HTML

### Deliverability
- Verify your email domain
- Warm up new accounts gradually
- Monitor bounce rates
- Remove invalid addresses

## Troubleshooting

### Emails not sending
- Verify email account is connected
- Check daily limits
- Review spam folder
- Check bounce reports

### Formatting issues
- Test in multiple email clients
- Simplify HTML
- Use inline styles
- Avoid complex layouts

### Signature not appearing
- Check default signature is set
- Verify signature is active
- Review template settings

### Low open rates
- Improve subject lines
- Check sender reputation
- Verify email list quality
- Test different send times
