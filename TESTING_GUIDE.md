# Nexwork Desktop - Testing Guide

## 🎉 READY TO TEST!

Your Nexwork Desktop application is complete and ready for testing!

---

## 🚀 Launch Instructions

### Start the Application
```bash
cd /Users/mac/Documents/Build/nexwork-desktop
npm run dev
```

**What happens:**
1. Vite dev server starts
2. Electron window opens
3. DevTools opens automatically (development mode)
4. System tray icon appears

---

## ✅ Testing Checklist

### 1. Dashboard View (Main Screen)

**What to test:**
- [ ] Statistics cards display (Total, In Progress, Completed, Pending)
- [ ] Feature cards show with progress bars
- [ ] Project status icons display correctly
- [ ] "Create Feature" button in header
- [ ] Sidebar navigation visible
- [ ] Empty state shows if no features

**Expected Result:**
- Beautiful dashboard with statistics
- Feature cards clickable
- Progress bars animated

---

### 2. Create Feature (Multi-Step Wizard)

**How to test:**
1. Click "Create Feature" button in header
2. **Step 1: Basic Info**
   - [ ] Enter feature name: "Test Payment Integration"
   - [ ] Check "Use custom Feature ID"
   - [ ] Enter ID: "TEST-001"
   - [ ] Add description (optional)
   - [ ] Click "Next"

3. **Step 2: Select Projects**
   - [ ] See list of available projects (from your Techbodia workspace)
   - [ ] Select 2-3 projects (kirby, tycho, coloris, hermes)
   - [ ] Click "Next"

4. **Step 3: Choose Template**
   - [ ] See template options (default, jira)
   - [ ] Click on "jira" template
   - [ ] See template preview/description
   - [ ] Click "Create Feature"

**Expected Result:**
- Modal closes
- Success notification appears
- New feature appears in dashboard
- Feature folder created in `/Users/mac/Documents/Techbodia/features/`

---

### 3. Feature Details View

**How to test:**
1. Click on any feature card in dashboard
2. **Check details page shows:**
   - [ ] Feature name and ID in header
   - [ ] Progress statistics (percentage)
   - [ ] Git statistics (commits, files, lines)
   - [ ] Project list with statuses
   - [ ] Time tracking (created, started, elapsed)
   - [ ] Action buttons (Update, Complete, Delete)

3. **Test status update:**
   - [ ] Click "Update" button on a project
   - [ ] Change status from "pending" to "in_progress"
   - [ ] See notification appear
   - [ ] See tray menu update

**Expected Result:**
- Full feature details displayed
- Status updates work
- Notifications appear
- Progress updates

---

### 4. System Tray Integration

**How to test:**
1. **Find tray icon:**
   - [ ] Look in menu bar (top-right on Mac)
   - [ ] See Nexwork icon

2. **Right-click tray icon:**
   - [ ] See context menu
   - [ ] See feature statistics (Total, In Progress, Completed)
   - [ ] See menu items: Show Dashboard, Create Feature, Settings, Quit

3. **Test tray actions:**
   - [ ] Click "Create Feature" from tray → Modal opens
   - [ ] Click "Settings" from tray → Settings page opens
   - [ ] Click "Show Dashboard" → Window shows/focuses
   - [ ] Click tray icon (left-click) → Window toggles show/hide

**Expected Result:**
- Tray icon visible
- Menu shows live stats
- Actions work correctly
- Window shows/hides on click

---

### 5. Settings Panel

**How to test:**
1. Click "Settings" in sidebar OR from tray menu
2. **Check settings sections:**
   - [ ] Workspace Configuration (shows current workspace)
   - [ ] Search Paths (editable)
   - [ ] Exclude Patterns (editable)
   - [ ] Default Template dropdown
   - [ ] Preferences toggles (dark mode, notifications, startup)
   - [ ] About section (versions)

3. **Test saving:**
   - [ ] Change default template to "jira"
   - [ ] Click "Save Settings"
   - [ ] See success message

**Expected Result:**
- All settings visible
- Can modify values
- Save button works
- Settings persist

---

### 6. Native Notifications

**What to watch for:**
- [ ] Notification when feature created
- [ ] Notification when project status updated
- [ ] Notification when feature completed
- [ ] Notifications appear in OS notification center

**How they look:**
```
💬 "Feature Created"
   "Test Payment Integration (TEST-001) has been created successfully"

💬 "Project Status Updated"
   "kirby in Test Payment Integration is now in_progress"

💬 "Feature Completed"
   "Test Payment Integration (TEST-001) is now complete!"
```

---

### 7. Navigation Flow

**Test navigation:**
1. **Dashboard → Feature Details:**
   - [ ] Click feature card → Details page opens
   - [ ] Click "Back to Dashboard" → Returns to dashboard

2. **Dashboard → Settings:**
   - [ ] Click "Settings" in sidebar → Settings page opens
   - [ ] Click "Dashboard" in sidebar → Returns to dashboard

3. **Keyboard shortcuts:** (if implemented)
   - [ ] Cmd+N (Mac) / Ctrl+N (Windows) → Create feature
   - [ ] Cmd+, (Mac) / Ctrl+, (Windows) → Settings

**Expected Result:**
- Smooth transitions
- No errors in console
- State preserved

---

### 8. Real Data Integration

**Verify CLI integration:**
1. **Check feature folder:**
   ```bash
   cd /Users/mac/Documents/Techbodia/features
   ls -la
   ```
   - [ ] See new feature folder with date stamp
   - [ ] README.md generated from template
   - [ ] Feature tracked in config

2. **Check config file:**
   ```bash
   cat /Users/mac/Documents/Techbodia/.multi-repo-config.json
   ```
   - [ ] See new feature in JSON
   - [ ] Projects listed
   - [ ] Timestamps correct

**Expected Result:**
- Real files created
- Config updated
- Data persists after app restart

---

### 9. Window Behavior

**Test window management:**
- [ ] Close window → Hides to tray (doesn't quit)
- [ ] Click tray icon → Window shows again
- [ ] Minimize window → Minimizes to dock/taskbar
- [ ] Maximize window → Fills screen
- [ ] Resize window → Maintains layout

**Expected Result:**
- Window doesn't quit on close
- Can show/hide from tray
- Layout responsive

---

### 10. Error Handling

**Test error scenarios:**
1. **Invalid feature creation:**
   - [ ] Try creating feature with empty name → See error
   - [ ] Try duplicate feature ID → See error
   - [ ] Try with no projects selected → See validation error

2. **Missing workspace:**
   - [ ] Check if workspace doesn't exist → Graceful error

**Expected Result:**
- Clear error messages
- No app crashes
- User-friendly feedback

---

## 🐛 What to Look For (Potential Issues)

### Known Limitations
1. **Tray icon**: May not show icon image (using empty icon for now)
2. **Worktree creation**: Not fully implemented (file structure created but not git worktrees)
3. **Git stats**: May show 0 (real git integration pending)
4. **Dark mode**: UI exists but not functional yet

### Console Errors
- Open DevTools (Cmd+Option+I)
- Watch Console tab for errors
- Report any red errors you see

---

## 📊 Success Criteria

✅ **App launches successfully**  
✅ **Dashboard displays features**  
✅ **Can create new feature**  
✅ **Feature details view works**  
✅ **System tray accessible**  
✅ **Notifications appear**  
✅ **Settings can be modified**  
✅ **Real files created in workspace**  
✅ **Navigation works smoothly**  
✅ **No crashes or freezes**

---

## 🎯 Quick Test Flow (5 minutes)

1. **Launch app** → Dashboard loads
2. **Create feature** → "My Test Feature"
3. **Select projects** → Pick 2-3
4. **Choose template** → JIRA
5. **See notification** → Feature created
6. **Click feature card** → Details view
7. **Update status** → Change project to in_progress
8. **Check tray** → Right-click, see updated stats
9. **Open settings** → Change template to default
10. **Save & test** → Create another feature

**If all works: SUCCESS! 🎉**

---

## 📝 Feedback Template

After testing, note:

**What worked well:**
- 

**What didn't work:**
- 

**Suggestions:**
- 

**Bugs found:**
- 

---

## 🆘 Troubleshooting

### App won't start
```bash
# Check for errors
npm run dev 2>&1 | grep -i error

# Rebuild
rm -rf dist dist-electron node_modules
npm install
npm run dev
```

### Tray icon not showing
- This is expected (empty icon placeholder)
- Tray menu still works (right-click)

### No features showing
- Check if config file exists: `ls ~/.multi-repo-config.json`
- Check workspace: `/Users/mac/Documents/Techbodia`

### DevTools not opening
- Press Cmd+Option+I (Mac) or Ctrl+Shift+I (Windows)

---

## 🎉 Ready to Test!

**Start the app:**
```bash
cd /Users/mac/Documents/Build/nexwork-desktop
npm run dev
```

**Have fun testing!** 🚀

Report any issues or suggestions!
