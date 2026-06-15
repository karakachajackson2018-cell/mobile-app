# RAVITEC — Agile Student Milestone Tracker

A Flutter mobile app for tracking final-year project tasks using Agile Scrum methodology.
All data is stored locally in memory — no backend or internet required.

---

## Project Structure

```
ravitec/
├── lib/
│   ├── main.dart                          # App entry point
│   ├── models/
│   │   ├── task.dart                      # Task data model & TaskStatus enum
│   │   └── app_state.dart                 # Global in-memory state (tasks, user)
│   └── screens/
│       ├── splash_screen.dart             # Page 1: Welcome / Splash
│       ├── login_screen.dart              # Page 2: Local Login (form validation)
│       ├── dashboard_screen.dart          # Page 3: Dashboard with metric cards
│       ├── sprint_board_screen.dart       # Page 4: Sprint Board (core page)
│       ├── task_detail_screen.dart        # Page 5: Task Details & Status editor
│       └── about_screen.dart             # Page 6: About & Agile Scrum info
├── test/
│   └── widget_test.dart
└── pubspec.yaml
```

---

## Pages Overview

| Page | Screen | Key Widgets |
|------|--------|-------------|
| 1 | Splash / Welcome | `Column`, `Icon`, `Text`, `ElevatedButton` |
| 2 | Local Login | `Form`, `TextFormField`, validators |
| 3 | Dashboard | `Card`, `Row`, `LinearProgressIndicator` |
| 4 | Sprint Board | `ListView.builder`, `FloatingActionButton`, `showDialog` |
| 5 | Task Details | `DropdownButton`, `TextField`, `setState` |
| 6 | About & Insights | Static `Text`, `OutlinedButton`, reset logic |

---

## How to Run

### Prerequisites
- [Flutter SDK](https://docs.flutter.dev/get-started/install) (3.0.0 or higher)
- VS Code with the Flutter extension
- An Android emulator, iOS simulator, or physical device

### Steps

```bash
# 1. Navigate into the project folder
cd ravitec

# 2. Get dependencies
flutter pub get

# 3. Run the app
flutter run
```

### Run on a specific device
```bash
flutter devices            # list available devices
flutter run -d <device_id>
```

---

## Navigation Flow

```
Page 1 (Splash) → Page 2 (Login) → Page 3 (Dashboard) → Page 4 (Sprint Board) → Page 5 (Task Detail)
                                                     ↕
                                              Page 6 (About) — accessible via ℹ️ icon on Dashboard
```

---

## Key Features

- **Local-only**: Zero network calls. Works 100% offline.
- **Form validation**: Login screen checks for empty fields before proceeding.
- **Dynamic state**: Adding/editing tasks instantly refreshes the UI via `setState`.
- **Swipe to delete**: Swipe left on any task card on the Sprint Board to remove it.
- **Status tracking**: Each task has a `DropdownButton` on the detail page to change its status.
- **Reset board**: The About page has a button to clear all tasks and return to the Splash screen.

---

## Agile Scrum Concepts Covered (Syllabus Checklist)

- [x] Sprint planning (task priority + milestone targeting)
- [x] Kanban board visualisation (To Do / In Progress / Done)
- [x] Iterative workflow (tasks can be updated at any time)
- [x] Definition of Done (status dropdown on Task Detail screen)
- [x] About screen explains Scrum roles, Sprints, and Kanban

---

*Built for a Final-Year Project demonstration. Flutter + VS Code.*
