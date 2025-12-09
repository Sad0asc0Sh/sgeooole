# ✅ Jalali (Shamsi) Date Implementation for Time-Based Offers

## 🎯 Overview

This document explains the implementation of Jalali (Persian/Shamsi) calendar support for Flash Deals and Special Offers in the Admin Panel, while maintaining ISO date format for the backend and countdown timers.

---

## 🏗️ Architecture

### Core Principle
**Admin selects dates in Jalali → Stored as ISO in MongoDB → Frontend displays countdown from ISO**

```
┌─────────────────────────────────────────────────────────────────┐
│ Admin Panel (Jalali Calendar)                                   │
│ Admin selects: 1403/09/04 18:30 (Shamsi)                       │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ JalaliDateTimePicker Component                                  │
│ Converts to: JavaScript Date object                             │
│ Output: Date(2024-11-24T15:00:00.000Z)                         │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ ProductForm.handleFinish()                                       │
│ Converts to: ISO String                                          │
│ Payload: "flashDealEndTime": "2024-11-24T15:00:00.000Z"        │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend API (POST /api/products)                                │
│ Saves to MongoDB as Date type                                   │
│ MongoDB: flashDealEndTime: ISODate("2024-11-24T15:00:00.000Z") │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ User Frontend (GET /api/products)                               │
│ Receives: "flashDealEndTime": "2024-11-24T15:00:00.000Z"       │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ useCountdown Hook                                                │
│ Calculates: 02:15:45 remaining                                  │
│ Updates every second                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Package Installed

```bash
npm install react-multi-date-picker
```

**Dependencies:**
- `react-multi-date-picker` - Main date picker component
- `react-date-object` - Date manipulation library (included)
- `react-date-object/calendars/persian` - Persian calendar
- `react-date-object/locales/persian_fa` - Farsi locale

---

## 🧩 Components

### 1. JalaliDateTimePicker Component
**Location:** `admin/src/components/JalaliDateTimePicker.jsx`

**Purpose:** Reusable Jalali date/time picker that handles conversion between Jalali and ISO dates.

**Features:**
- Persian calendar with Farsi locale
- Date and time selection in a single picker
- Converts Jalali dates to JavaScript Date objects
- Handles ISO string input for edit mode
- Customizable styling (border color, focus color)
- RTL support
- Time picker integrated (hours and minutes)

**Props:**
| Prop | Type | Description | Default |
|------|------|-------------|---------|
| `value` | string | ISO date string (e.g., "2024-12-20T14:30:00.000Z") | - |
| `onChange` | function | Callback with JavaScript Date object | - |
| `placeholder` | string | Input placeholder text | "انتخاب تاریخ و زمان" |
| `style` | object | Custom inline styles | {} |
| `borderColor` | string | Border color | "#d9d9d9" |
| `focusColor` | string | Focus border color | "#1890ff" |

**Usage Example:**
```jsx
import JalaliDateTimePicker from '../../components/JalaliDateTimePicker'

<JalaliDateTimePicker
  value={flashDealEndTime} // ISO string
  onChange={(date) => setFlashDealEndTime(date)} // Date object
  placeholder="انتخاب تاریخ و زمان پایان"
  borderColor="#d9d9d9"
  focusColor="#1890ff"
/>
```

**Internal Logic:**

1. **Loading Existing Date (Edit Mode):**
   ```javascript
   useEffect(() => {
     if (value) {
       const jsDate = new Date(value) // Convert ISO to JS Date
       const persianDate = new DateObject({
         date: jsDate,
         calendar: persian,
         locale: persian_fa,
       })
       setDateValue(persianDate) // Display in Jalali
     }
   }, [value])
   ```

2. **User Selection:**
   ```javascript
   const handleChange = (dateObject) => {
     const jsDate = dateObject.toDate() // Convert Jalali to JS Date
     onChange(jsDate) // Return JS Date to parent
   }
   ```

---

### 2. Updated ProductForm Component
**Location:** `admin/src/pages/products/ProductForm.jsx`

**Changes:**

#### A. Import Statement
```javascript
import JalaliDateTimePicker from '../../components/JalaliDateTimePicker'
```

#### B. State Management
```javascript
// State now stores Date objects or ISO strings
const [flashDealEndTime, setFlashDealEndTime] = useState('')
const [specialOfferEndTime, setSpecialOfferEndTime] = useState('')
```

#### C. Loading Product Data (Edit Mode)
```javascript
// Load promotion fields (ISO strings for JalaliDateTimePicker)
setDiscount(p.discount || 0)
setIsFlashDeal(p.isFlashDeal || false)
setFlashDealEndTime(p.flashDealEndTime || '') // Pass ISO string directly
setIsSpecialOffer(p.isSpecialOffer || false)
setSpecialOfferEndTime(p.specialOfferEndTime || '')
```

#### D. Form Submission
```javascript
// اضافه کردن فیلدهای فروش ویژه
payload.isFlashDeal = isFlashDeal
if (isFlashDeal && flashDealEndTime) {
  // flashDealEndTime might be Date object or ISO string
  payload.flashDealEndTime = flashDealEndTime instanceof Date
    ? flashDealEndTime.toISOString()
    : new Date(flashDealEndTime).toISOString()
}

payload.isSpecialOffer = isSpecialOffer
if (isSpecialOffer && specialOfferEndTime) {
  payload.specialOfferEndTime = specialOfferEndTime instanceof Date
    ? specialOfferEndTime.toISOString()
    : new Date(specialOfferEndTime).toISOString()
}
```

#### E. UI Replacement
**Before (Native HTML5):**
```jsx
<input
  type="datetime-local"
  value={flashDealEndTime}
  onChange={(e) => setFlashDealEndTime(e.target.value)}
/>
```

**After (Jalali):**
```jsx
<JalaliDateTimePicker
  value={flashDealEndTime}
  onChange={(date) => setFlashDealEndTime(date)}
  placeholder="انتخاب تاریخ و زمان پایان"
  borderColor="#d9d9d9"
  focusColor="#1890ff"
/>
```

---

## 🔄 Complete Data Flow Example

### Scenario: Admin Creates Flash Deal

**Step 1: Admin Selects Date**
```
Admin Panel → Jalali Date Picker
User selects: 1403/09/04 18:30 (Shamsi)
              ↓
JalaliDateTimePicker converts to:
JavaScript Date: Sun Nov 24 2024 18:30:00 GMT+0330
```

**Step 2: Form Submission**
```javascript
// ProductForm.handleFinish()
const payload = {
  isFlashDeal: true,
  flashDealEndTime: new Date("2024-11-24T15:00:00.000Z").toISOString()
  // Result: "2024-11-24T15:00:00.000Z"
}

await api.post('/v1/admin/products', payload)
```

**Step 3: Backend Storage**
```javascript
// MongoDB Document
{
  _id: "673cc2ae8f4b1234567890ab",
  name: "محصول تست",
  isFlashDeal: true,
  flashDealEndTime: ISODate("2024-11-24T15:00:00.000Z")
}
```

**Step 4: Frontend Fetches Product**
```javascript
// GET /api/products?isFlashDeal=true
{
  "success": true,
  "data": [
    {
      "_id": "673cc2ae8f4b1234567890ab",
      "name": "محصول تست",
      "isFlashDeal": true,
      "flashDealEndTime": "2024-11-24T15:00:00.000Z"
    }
  ]
}
```

**Step 5: Countdown Display**
```javascript
// useCountdown Hook
const countDownDate = new Date("2024-11-24T15:00:00.000Z").getTime()
const now = new Date().getTime()
const distance = countDownDate - now

// If distance = 8145000 (2 hours, 15 minutes, 45 seconds)
// Returns: { hours: "02", minutes: "15", seconds: "45", isExpired: false }
```

**Step 6: UI Rendering**
```jsx
// FlashOfferRail Component
<div className="timer-badge">
  02:15:45
</div>
```

---

## 🧪 Testing Instructions

### Test Case 1: Create Flash Deal Product

**Setup:**
1. Go to Admin Panel → Products → Create Product
2. Navigate to "فروش ویژه و تخفیف" tab
3. Enable "پیشنهاد لحظه‌ای" checkbox

**Action:**
1. Click on the Jalali Date Picker
2. Select date: 1403/09/05 (tomorrow in Shamsi)
3. Select time: 20:00
4. Save product

**Expected Result:**
- ✅ Date picker shows Jalali calendar
- ✅ Selected date displays in Farsi (۱۴۰۳/۰۹/۰۵)
- ✅ Product saves successfully
- ✅ Frontend shows product with countdown timer
- ✅ Countdown is accurate to selected time

**Backend Verification:**
```bash
# Check MongoDB document
db.products.findOne({ isFlashDeal: true })

# Should see:
# flashDealEndTime: ISODate("2024-11-25T16:30:00.000Z")
# (Actual time depends on timezone offset)
```

---

### Test Case 2: Edit Existing Flash Deal

**Setup:**
1. Create a Flash Deal product (as above)
2. Go to Admin Panel → Products → Edit that product
3. Navigate to "فروش ویژه و تخفیف" tab

**Expected Result:**
- ✅ "پیشنهاد لحظه‌ای" checkbox is checked
- ✅ Jalali Date Picker shows the saved date in Shamsi format
- ✅ Date converts correctly: 2024-11-25 → 1403/09/05

**Action:**
1. Change date to 1403/09/06 18:00
2. Save product

**Expected Result:**
- ✅ Date updates in database
- ✅ Frontend countdown updates to new time

---

### Test Case 3: Special Offer with Jalali Date

**Setup:**
1. Go to Admin Panel → Products → Create Product
2. Navigate to "فروش ویژه و تخفیف" tab
3. Enable "شگفت‌انگیز" checkbox

**Action:**
1. Select Jalali date: 1403/09/10 23:59
2. Save product

**Expected Result:**
- ✅ Product appears in SpecialOfferRail
- ✅ Global countdown timer shows correct remaining time
- ✅ Multiple products share same timer if same end time

---

### Test Case 4: Timezone Handling

**Important:** The component handles timezone conversion automatically.

**Example:**
- Admin in Tehran (UTC+3:30) selects: 1403/09/05 20:00
- Converts to: 2024-11-25T16:30:00.000Z (UTC)
- Frontend in any timezone shows correct countdown

**Verification:**
```javascript
// In browser console on Frontend
const endTime = new Date("2024-11-25T16:30:00.000Z")
console.log(endTime.toLocaleString('fa-IR')) // Shows in user's local time
```

---

### Test Case 5: Expired Offers

**Setup:**
1. Create Flash Deal with past date
2. Or wait for active deal to expire

**Expected Result:**
- ✅ FlashOfferRail hides the product automatically
- ✅ `isExpired: true` in useCountdown hook
- ✅ No error in console
- ✅ Backend query filters out expired products

---

## 🛠️ Troubleshooting

### Issue 1: Date Picker Not Showing Jalali Calendar

**Symptom:** Date picker shows Gregorian calendar

**Solution:**
```javascript
// Ensure imports are correct
import persian from 'react-date-object/calendars/persian'
import persian_fa from 'react-date-object/locales/persian_fa'

// Pass to DatePicker
<DatePicker
  calendar={persian}
  locale={persian_fa}
  // ...
/>
```

---

### Issue 2: Date Not Loading in Edit Mode

**Symptom:** Date picker is empty when editing product

**Debug:**
```javascript
// In JalaliDateTimePicker component
useEffect(() => {
  console.log('Received value:', value)
  if (value) {
    const jsDate = new Date(value)
    console.log('JS Date:', jsDate)
    console.log('Is valid:', !isNaN(jsDate.getTime()))
  }
}, [value])
```

**Common Causes:**
- Backend not returning `flashDealEndTime` field
- Field is null or undefined
- Invalid date format

---

### Issue 3: Countdown Shows Wrong Time

**Symptom:** Timer doesn't match expected time

**Debug:**
```javascript
// In useCountdown hook
console.log('Target date string:', targetDate)
console.log('Target date timestamp:', new Date(targetDate).getTime())
console.log('Current timestamp:', new Date().getTime())
console.log('Difference (ms):', countDown)
```

**Common Causes:**
- Timezone mismatch
- Date stored in wrong format
- Server time vs client time difference

---

### Issue 4: Styles Not Applying

**Symptom:** Date picker looks unstyled

**Solution:**
```javascript
// Ensure CSS import in JalaliDateTimePicker.jsx
import 'react-multi-date-picker/styles/colors/blue.css'

// Or import in main CSS file
@import 'react-multi-date-picker/styles/colors/blue.css';
```

---

## 📊 Comparison: Before vs After

| Aspect | Before (HTML5) | After (Jalali) |
|--------|----------------|----------------|
| Calendar Type | Gregorian | Shamsi (Persian) |
| Admin UX | Confusing for Persian users | Native experience |
| Date Format | 2024-11-25T18:30 | ۱۴۰۳/۰۹/۰۵ ۱۸:۳۰ |
| Timezone | Manual calculation needed | Automatic handling |
| Browser Support | Modern browsers only | All browsers |
| Mobile Support | Native picker (varies) | Consistent UI |
| RTL Support | Limited | Full support |
| Localization | English only | Persian labels |

---

## 🎨 UI Screenshots

### Jalali Date Picker (Closed)
```
┌─────────────────────────────────────────────┐
│ زمان پایان تایمر (تاریخ شمسی)               │
│ ┌─────────────────────────────────────────┐ │
│ │ ۱۴۰۳/۰۹/۰۵ ۱۸:۳۰              🗓️     │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Jalali Date Picker (Open)
```
┌─────────────────────────────────────────────┐
│ ۱۴۰۳ آذر                                    │
├─────┬─────┬─────┬─────┬─────┬─────┬─────────┤
│ شنبه│یکش │دوش │سه  │چهار│پنج │جمعه        │
├─────┼─────┼─────┼─────┼─────┼─────┼─────────┤
│  ۱  │  ۲  │  ۳  │ [۴] │  ۵  │  ۶  │   ۷     │
│  ۸  │  ۹  │ ۱۰  │ ۱۱  │ ۱۲  │ ۱۳  │  ۱۴     │
│ ۱۵  │ ۱۶  │ ۱۷  │ ۱۸  │ ۱۹  │ ۲۰  │  ۲۱     │
│ ۲۲  │ ۲۳  │ ۲۴  │ ۲۵  │ ۲۶  │ ۲۷  │  ۲۸     │
│ ۲۹  │ ۳۰  │     │     │     │     │         │
└─────┴─────┴─────┴─────┴─────┴─────┴─────────┘
         ┌─────────┐
         │  ۱۸:۳۰  │ ← Time Picker
         └─────────┘
```

---

## 🚀 Future Enhancements

1. **Jalali Date Range Picker**
   - Select start and end dates for campaigns
   - Useful for bulk operations

2. **Preset Options**
   - "2 hours from now"
   - "Tomorrow at noon"
   - "End of week"

3. **Recurring Offers**
   - Weekly/Monthly Flash Deals
   - Automatic date calculation

4. **Admin Dashboard**
   - Show active/upcoming/expired offers
   - Calendar view of all promotions

5. **Notification System**
   - Alert admin when offer is about to expire
   - Remind to create new offers

---

## 📝 Code Reference

### Key Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `admin/src/components/JalaliDateTimePicker.jsx` | NEW - Jalali picker component | 1-100 |
| `admin/src/pages/products/ProductForm.jsx` | Import, state, handlers, UI | 27, 103-108, 333-347, 677-683, 737-743 |

### Dependencies Added

```json
{
  "react-multi-date-picker": "^4.6.1"
}
```

---

## ✅ Implementation Checklist

- [x] Install react-multi-date-picker package
- [x] Create JalaliDateTimePicker component
- [x] Add Persian calendar and locale
- [x] Implement date conversion (Jalali ↔ ISO)
- [x] Update ProductForm imports
- [x] Replace HTML5 datetime-local inputs
- [x] Update state management for Date objects
- [x] Handle edit mode (ISO → Jalali display)
- [x] Handle form submission (Jalali → ISO)
- [x] Remove unused toDatetimeLocal helper
- [x] Test create product flow
- [x] Test edit product flow
- [x] Verify frontend countdown accuracy
- [x] Check timezone handling

---

**Date**: November 24, 2025
**Status**: ✅ **JALALI DATE SUPPORT - PRODUCTION READY**
**Package**: react-multi-date-picker v4.6.1
**Calendar**: Persian (Shamsi/Jalali)
