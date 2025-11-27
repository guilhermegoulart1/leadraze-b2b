# Importing Leads

Import leads in bulk from CSV files to quickly populate your pipeline.

## CSV Import

### Starting an Import

1. Navigate to **CRM** → **Leads**
2. Click **Import** button
3. Select **Import from CSV**

### Preparing Your CSV

Before importing, ensure your CSV file:

- Has headers in the first row
- Uses UTF-8 encoding
- Has consistent data format
- Contains no empty rows

### Supported Columns

| Column | Description | Required |
|--------|-------------|----------|
| name | Full name | Recommended |
| first_name | First name | No |
| last_name | Last name | No |
| email | Email address | Recommended |
| phone | Phone number | No |
| company | Company name | No |
| title / job_title | Job title | No |
| location | Geographic location | No |
| industry | Industry sector | No |
| website | Company website | No |
| linkedin_url | LinkedIn profile URL | No |

### Sample CSV Format

```csv
name,email,company,title,phone,location
John Smith,john@acme.com,Acme Inc,CEO,+1234567890,New York
Jane Doe,jane@techco.com,TechCo,CTO,+0987654321,San Francisco
```

## Import Wizard

### Step 1: Upload File

1. Drag and drop your CSV file
2. Or click to browse and select
3. File is validated automatically

### Step 2: Map Columns

Match your CSV columns to GetRaze fields:

1. Review detected columns
2. Select the corresponding GetRaze field
3. Or skip columns you don't need

**Column Mapping Interface:**

| Your Column | GetRaze Field |
|-------------|---------------|
| Nome | → Name |
| E-mail | → Email |
| Empresa | → Company |
| Cargo | → Title |

::: tip
GetRaze auto-detects common column names. Review mappings before proceeding.
:::

### Step 3: Preview

Review the data before importing:

- See how data will appear
- Check for formatting issues
- Verify column mappings
- Note any warnings

### Step 4: Import

1. Click **Import**
2. Wait for processing
3. Review results

## Import Results

After import, you'll see:

| Metric | Description |
|--------|-------------|
| Total Rows | Lines in your CSV |
| Imported | Successfully added |
| Duplicates | Already exist (skipped) |
| Errors | Rows that couldn't be imported |

### Handling Duplicates

GetRaze detects duplicates by:
- Email address (primary)
- Phone number (secondary)
- Name + Company (fallback)

Duplicate behavior:
- Existing leads are not overwritten
- Duplicates are counted but skipped
- You can export duplicates for review

### Handling Errors

Common import errors:

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid email | Email format wrong | Fix email format |
| Missing required | Required field empty | Add missing data |
| Encoding issue | Non-UTF8 characters | Save as UTF-8 |
| Too many columns | Malformed CSV | Check CSV structure |

## Import to Contact Lists

Import directly to a contact list:

1. Go to **Activation** → **Contact Lists**
2. Click **Import CSV**
3. Select or create a list
4. Follow the import wizard

This adds contacts to both:
- Your lead database
- The selected contact list

## Best Practices

### Before Importing

**Clean your data:**
- Remove empty rows
- Fix obvious typos
- Standardize formats
- Remove test entries

**Verify email addresses:**
- Check for valid format
- Remove bounced addresses
- Consider email verification service

**Standardize fields:**
- Consistent naming
- Consistent phone format
- Proper capitalization

### During Import

**Start small:**
- Test with 10-20 rows first
- Verify data appears correctly
- Then import full file

**Map carefully:**
- Double-check mappings
- Use preview to verify
- Skip unnecessary columns

### After Import

**Verify data:**
- Spot-check imported leads
- Verify key fields populated
- Check for unexpected values

**Organize:**
- Add tags for import batch
- Assign to appropriate stage
- Set up follow-up tasks

## Large Imports

For files over 1,000 rows:

1. Processing may take longer
2. You'll receive a notification when complete
3. Background processing doesn't block your work

::: info
Very large imports (10,000+ rows) may be processed in batches. You can continue using GetRaze while import runs.
:::

## Exporting Leads

You can also export leads:

1. Select leads to export (or select all)
2. Click **Export**
3. Choose format (CSV)
4. Download file

Exported data includes:
- All lead fields
- Tags
- Status
- Created date
- Last activity

## Troubleshooting

### File won't upload
- Check file is .csv format
- Verify file size is under limit
- Try a different browser
- Ensure stable connection

### Columns not detected
- Add header row to CSV
- Use standard column names
- Check for special characters

### Wrong data in fields
- Review column mappings
- Check CSV structure
- Look for shifted columns

### Many duplicates
- Check duplicate detection settings
- Verify emails are correct
- Review existing database
