const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'ravitec-hmis-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json());

// =============================================
// DATABASE SETUP
// =============================================
const db = new sqlite3.Database('./ravitec_hmis.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('✅ Connected to Ravitec HMIS Database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Hostel Blocks
    db.run(`
        CREATE TABLE IF NOT EXISTS hostel_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            block_name TEXT NOT NULL UNIQUE,
            block_code TEXT UNIQUE,
            total_rooms INTEGER DEFAULT 0,
            floors INTEGER DEFAULT 1,
            warden_name TEXT,
            warden_phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Rooms
    db.run(`
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            block_id INTEGER,
            room_number TEXT NOT NULL,
            floor_number INTEGER,
            room_type TEXT CHECK(room_type IN ('single', 'double', 'triple', 'dormitory')),
            capacity INTEGER DEFAULT 2,
            current_occupancy INTEGER DEFAULT 0,
            rent_amount DECIMAL(10,2),
            is_available BOOLEAN DEFAULT 1,
            has_ac BOOLEAN DEFAULT 0,
            has_attached_bathroom BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (block_id) REFERENCES hostel_blocks(id) ON DELETE CASCADE,
            UNIQUE(block_id, room_number)
        )
    `);

    // Students
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            course TEXT,
            department TEXT,
            semester INTEGER,
            year_of_study INTEGER,
            gender TEXT CHECK(gender IN ('male', 'female', 'other')),
            date_of_birth DATE,
            guardian_name TEXT,
            guardian_phone TEXT,
            address TEXT,
            emergency_contact TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Room Allocations
    db.run(`
        CREATE TABLE IF NOT EXISTS room_allocations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            room_id INTEGER,
            block_id INTEGER,
            allocated_date DATE DEFAULT CURRENT_DATE,
            check_in_date DATE,
            check_out_date DATE,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'pending', 'completed', 'cancelled')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            FOREIGN KEY (block_id) REFERENCES hostel_blocks(id) ON DELETE CASCADE
        )
    `);

    // Fees/Payments
    db.run(
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            receipt_number TEXT UNIQUE NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            payment_type TEXT CHECK(payment_type IN ('room_rent', 'mess_fee', 'caution_deposit', 'electricity', 'other')),
            payment_date DATE DEFAULT CURRENT_DATE,
            due_date DATE,
            paid_date DATE,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue', 'cancelled')),
            payment_method TEXT CHECK(payment_method IN ('cash', 'bank_transfer', 'upi', 'credit_card', 'other')),
            transaction_id TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
    `);

    // Mess Management
    db.run(`
        CREATE TABLE IF NOT EXISTS mess_meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meal_date DATE NOT NULL,
            meal_type TEXT CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),
            menu_item TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Mess Attendance
    db.run(`
        CREATE TABLE IF NOT EXISTS mess_attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            meal_id INTEGER,
            attended BOOLEAN DEFAULT 0,
            cancelled BOOLEAN DEFAULT 0,
            cancellation_date DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY (meal_id) REFERENCES mess_meals(id) ON DELETE CASCADE,
            UNIQUE(student_id, meal_id)
        )
    `);

    // Maintenance Requests
    db.run(`
        CREATE TABLE IF NOT EXISTS maintenance_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            room_id INTEGER,
            issue_type TEXT CHECK(issue_type IN ('plumbing', 'electrical', 'furniture', 'ac', 'cleaning', 'other')),
            description TEXT NOT NULL,
            priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
            assigned_to TEXT,
            completed_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
        )
    `);

    // Complaints
    db.run(`
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            complaint_type TEXT CHECK(complaint_type IN ('noise', 'harassment', 'food_quality', 'facilities', 'staff', 'other')),
            description TEXT NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewing', 'resolved', 'rejected')),
            resolution TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
    `);

    // Visitors
    db.run(`
        CREATE TABLE IF NOT EXISTS visitors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            visitor_name TEXT NOT NULL,
            visitor_phone TEXT,
            relationship TEXT,
            id_proof TEXT,
            check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            check_out_time DATETIME,
            purpose TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
    `);

    // Notices/Announcements
    db.run(`
        CREATE TABLE IF NOT EXISTS notices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            target_audience TEXT CHECK(target_audience IN ('all', 'staff', 'students', 'specific_block')),
            block_id INTEGER,
            priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
            expires_at DATETIME,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (block_id) REFERENCES hostel_blocks(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    console.log('✅ All Ravitec HMIS tables created successfully');
    console.log('📊 Database: ravitec_hmis.db');
}

// =============================================
// MIDDLEWARE - Authentication
// =============================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// =============================================
// AUTHENTICATION ROUTES
// =============================================

// Register
app.post('/api/register', [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role = 'admin' } = req.body;

    try {
        const userExists = await new Promise((resolve, reject) => {
            db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (userExists) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
                [username, email, hashedPassword, role],
                function(err) {
                    if (err) reject(err);
                    resolve(this.lastID);
                }
            );
        });

        res.status(201).json({ 
            message: 'User registered successfully',
            userId: result 
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
app.post('/api/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// =============================================
// HOSTEL BLOCK ROUTES
// =============================================

// Get all blocks
app.get('/api/blocks', authenticateToken, (req, res) => {
    db.all('SELECT * FROM hostel_blocks ORDER BY block_name', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Create block
app.post('/api/blocks', authenticateToken, [
    body('block_name').notEmpty().withMessage('Block name is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { block_name, block_code, total_rooms, floors, warden_name, warden_phone } = req.body;

    db.run(
        `INSERT INTO hostel_blocks 
         (block_name, block_code, total_rooms, floors, warden_name, warden_phone) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [block_name, block_code || block_name.substring(0, 3).toUpperCase(), 
         total_rooms || 0, floors || 1, warden_name, warden_phone],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Block name already exists' });
                }
                return res.status(500).json({ error: 'Failed to create block' });
            }
            
            db.get('SELECT * FROM hostel_blocks WHERE id = ?', [this.lastID], (err, row) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to retrieve created block' });
                }
                res.status(201).json(row);
            });
        }
    );
});

// =============================================
// ROOM ROUTES
// =============================================

// Get rooms by block
app.get('/api/rooms/block/:blockId', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM rooms WHERE block_id = ? ORDER BY floor_number, room_number',
        [req.params.blockId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// Create room
app.post('/api/rooms', authenticateToken, [
    body('block_id').notEmpty().withMessage('Block ID is required'),
    body('room_number').notEmpty().withMessage('Room number is required'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { 
        block_id, room_number, floor_number, room_type, 
        capacity, rent_amount, has_ac, has_attached_bathroom 
    } = req.body;

    db.run(
        `INSERT INTO rooms 
         (block_id, room_number, floor_number, room_type, capacity, rent_amount, has_ac, has_attached_bathroom) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [block_id, room_number, floor_number || 1, room_type || 'double', 
         capacity || 2, rent_amount || 0, has_ac || 0, has_attached_bathroom || 0],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Room number already exists in this block' });
                }
                return res.status(500).json({ error: 'Failed to create room' });
            }
            
            db.get('SELECT * FROM rooms WHERE id = ?', [this.lastID], (err, row) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to retrieve created room' });
                }
                res.status(201).json(row);
            });
        }
    );
});

// =============================================
// STUDENT ROUTES
// =============================================

// Get all students
app.get('/api/students', authenticateToken, (req, res) => {
    db.all(
        `SELECT s.*, r.room_number, b.block_name, ra.status as allocation_status 
         FROM students s
         LEFT JOIN room_allocations ra ON s.id = ra.student_id AND ra.status = 'active'
         LEFT JOIN rooms r ON ra.room_id = r.id
         LEFT JOIN hostel_blocks b ON ra.block_id = b.id
         ORDER BY s.full_name`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// Create student
app.post('/api/students', authenticateToken, [
    body('student_id').notEmpty().withMessage('Student ID is required'),
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { 
        student_id, full_name, email, phone, course, department, 
        semester, year_of_study, gender, date_of_birth, 
        guardian_name, guardian_phone, address, emergency_contact 
    } = req.body;

    db.run(
        `INSERT INTO students 
         (student_id, full_name, email, phone, course, department, 
          semester, year_of_study, gender, date_of_birth, 
          guardian_name, guardian_phone, address, emergency_contact) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [student_id, full_name, email, phone, course, department, 
         semester, year_of_study, gender, date_of_birth, 
         guardian_name, guardian_phone, address, emergency_contact],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Student ID or email already exists' });
                }
                return res.status(500).json({ error: 'Failed to create student' });
            }
            
            db.get('SELECT * FROM students WHERE id = ?', [this.lastID], (err, row) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to retrieve created student' });
                }
                res.status(201).json(row);
            });
        }
    );
});

// =============================================
// ROOM ALLOCATION ROUTES
// =============================================

// Allocate room to student
app.post('/api/allocations', authenticateToken, [
    body('student_id').notEmpty().withMessage('Student ID is required'),
    body('room_id').notEmpty().withMessage('Room ID is required'),
    body('block_id').notEmpty().withMessage('Block ID is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { student_id, room_id, block_id, check_in_date, check_out_date } = req.body;

    // Check if room is available
    db.get(
        'SELECT current_occupancy, capacity FROM rooms WHERE id = ?',
        [room_id],
        (err, room) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!room) {
                return res.status(404).json({ error: 'Room not found' });
            }
            if (room.current_occupancy >= room.capacity) {
                return res.status(400).json({ error: 'Room is full' });
            }

            // Check if student already has active allocation
            db.get(
                'SELECT id FROM room_allocations WHERE student_id = ? AND status = "active"',
                [student_id],
                (err, allocation) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    if (allocation) {
                        return res.status(400).json({ error: 'Student already has an active room allocation' });
                    }

                    // Create allocation
                    db.run(
                        `INSERT INTO room_allocations 
                         (student_id, room_id, block_id, check_in_date, check_out_date, status) 
                         VALUES (?, ?, ?, ?, ?, 'active')`,
                        [student_id, room_id, block_id, check_in_date || new Date().toISOString().split('T')[0], check_out_date],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ error: 'Failed to allocate room' });
                            }

                            // Update room occupancy
                            db.run(
                                'UPDATE rooms SET current_occupancy = current_occupancy + 1 WHERE id = ?',
                                [room_id],
                                (err) => {
                                    if (err) {
                                        return res.status(500).json({ error: 'Failed to update room occupancy' });
                                    }
                                    
                                    db.get(
                                        `SELECT ra.*, s.full_name as student_name, s.student_id, r.room_number, b.block_name 
                                         FROM room_allocations ra
                                         JOIN students s ON ra.student_id = s.id
                                         JOIN rooms r ON ra.room_id = r.id
                                         JOIN hostel_blocks b ON ra.block_id = b.id
                                         WHERE ra.id = ?`,
                                        [this.lastID],
                                        (err, row) => {
                                            if (err) {
                                                return res.status(500).json({ error: 'Failed to retrieve allocation' });
                                            }
                                            res.status(201).json(row);
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// Get active allocations
app.get('/api/allocations/active', authenticateToken, (req, res) => {
    db.all(
        `SELECT ra.*, s.full_name as student_name, s.student_id, 
                r.room_number, b.block_name, b.block_code
         FROM room_allocations ra
         JOIN students s ON ra.student_id = s.id
         JOIN rooms r ON ra.room_id = r.id
         JOIN hostel_blocks b ON ra.block_id = b.id
         WHERE ra.status = 'active'
         ORDER BY ra.allocated_date DESC`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// =============================================
// PAYMENT ROUTES
// =============================================

// Record payment
app.post('/api/payments', authenticateToken, [
    body('student_id').notEmpty().withMessage('Student ID is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('payment_type').notEmpty().withMessage('Payment type is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { 
        student_id, amount, payment_type, due_date, 
        payment_method, transaction_id, notes 
    } = req.body;

    const receipt_number = `RCT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const paid_date = new Date().toISOString().split('T')[0];

    db.run(
        `INSERT INTO payments 
         (student_id, receipt_number, amount, payment_type, due_date, paid_date, status, payment_method, transaction_id, notes) 
         VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)`,
        [student_id, receipt_number, amount, payment_type, due_date, paid_date, 
         payment_method || 'cash', transaction_id, notes],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to record payment' });
            }
            
            db.get(
                `SELECT p.*, s.full_name as student_name, s.student_id 
                 FROM payments p
                 JOIN students s ON p.student_id = s.id
                 WHERE p.id = ?`,
                [this.lastID],
                (err, row) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to retrieve payment' });
                    }
                    res.status(201).json(row);
                }
            );
        }
    );
});

// Get student payments
app.get('/api/payments/student/:studentId', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC',
        [req.params.studentId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// Get all payments
app.get('/api/payments', authenticateToken, (req, res) => {
    db.all(
        `SELECT p.*, s.full_name as student_name, s.student_id 
         FROM payments p
         JOIN students s ON p.student_id = s.id
         ORDER BY p.payment_date DESC`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// =============================================
// MESS MANAGEMENT ROUTES
// =============================================

// Add meal
app.post('/api/mess/meals', authenticateToken, [
    body('meal_date').notEmpty().withMessage('Meal date is required'),
    body('meal_type').notEmpty().withMessage('Meal type is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { meal_date, meal_type, menu_item, description } = req.body;

    db.run(
        'INSERT INTO mess_meals (meal_date, meal_type, menu_item, description) VALUES (?, ?, ?, ?)',
        [meal_date, meal_type, menu_item, description],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to add meal' });
            }
            
            db.get('SELECT * FROM mess_meals WHERE id = ?', [this.lastID], (err, row) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to retrieve meal' });
                }
                res.status(201).json(row);
            });
        }
    );
});

// Get meals by date
app.get('/api/mess/meals/date/:date', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM mess_meals WHERE meal_date = ? ORDER BY meal_type',
        [req.params.date],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// Record mess attendance
app.post('/api/mess/attendance', authenticateToken, [
    body('student_id').notEmpty().withMessage('Student ID is required'),
    body('meal_id').notEmpty().withMessage('Meal ID is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { student_id, meal_id, attended, cancelled } = req.body;

    db.run(
        `INSERT OR REPLACE INTO mess_attendance 
         (student_id, meal_id, attended, cancelled) 
         VALUES (?, ?, ?, ?)`,
        [student_id, meal_id, attended || 0, cancelled || 0],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to record attendance' });
            }
            res.json({ message: 'Attendance recorded successfully' });
        }
    );
});

// =============================================
// MAINTENANCE REQUEST ROUTES
// =============================================

// Create maintenance request
app.post('/api/maintenance', authenticateToken, [
    body('student_id').notEmpty().withMessage('Student ID is required'),
    body('issue_type').notEmpty().withMessage('Issue type is required'),
    body('description').notEmpty().withMessage('Description is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { student_id, room_id, issue_type, description, priority } = req.body;

    db.run(
        `INSERT INTO maintenance_requests 
         (student_id, room_id, issue_type, description, priority, status) 
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [student_id, room_id, issue_type, description, priority || 'medium'],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to create request' });
            }
            
            db.get(
                `SELECT mr.*, s.full_name as student_name, r.room_number 
                 FROM maintenance_requests mr
                 JOIN students s ON mr.student_id = s.id
                 LEFT JOIN rooms r ON mr.room_id = r.id
                 WHERE mr.id = ?`,
                [this.lastID],
                (err, row) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to retrieve request' });
                    }
                    res.status(201).json(row);
                }
            );
        }
    );
});

// Get maintenance requests
app.get('/api/maintenance', authenticateToken, (req, res) => {
    const status = req.query.status;
    let query = `
        SELECT mr.*, s.full_name as student_name, s.student_id, r.room_number, b.block_name
        FROM maintenance_requests mr
        JOIN students s ON mr.student_id = s.id
        LEFT JOIN rooms r ON mr.room_id = r.id
        LEFT JOIN hostel_blocks b ON r.block_id = b.id
    `;
    let params = [];

    if (status) {
        query += ' WHERE mr.status = ?';
        params.push(status);
    }

    query += ' ORDER BY mr.created_at DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Update maintenance request status
app.put('/api/maintenance/:id', authenticateToken, [
    body('status').notEmpty().withMessage('Status is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { status, assigned_to, completed_date } = req.body;
    const requestId = req.params.id;

    db.run(
        `UPDATE maintenance_requests 
         SET status = ?, assigned_to = ?, completed_date = ? 
         WHERE id = ?`,
        [status, assigned_to, completed_date, requestId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update request' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Request not found' });
            }
            res.json({ message: 'Request updated successfully' });
        }
    );
});

// =============================================
// COMPLAINT ROUTES
// =============================================

// Submit complaint
app.post('/api/complaints', authenticateToken, [
    body('student_id').notEmpty().withMessage('Student ID is required'),
    body('complaint_type').notEmpty().withMessage('Complaint type is required'),
    body('description').notEmpty().withMessage('Description is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { student_id, complaint_type, description } = req.body;

    db.run(
        'INSERT INTO complaints (student_id, complaint_type, description, status) VALUES (?, ?, ?, "pending")',
        [student_id, complaint_type, description],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to submit complaint' });
            }
            
            db.get(
                `SELECT c.*, s.full_name as student_name, s.student_id 
                 FROM complaints c
                 JOIN students s ON c.student_id = s.id
                 WHERE c.id = ?`,
                [this.lastID],
                (err, row) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to retrieve complaint' });
                    }
                    res.status(201).json(row);
                }
            );
        }
    );
});

// Get complaints
app.get('/api/complaints', authenticateToken, (req, res) => {
    const status = req.query.status;
    let query = `
        SELECT c.*, s.full_name as student_name, s.student_id 
        FROM complaints c
        JOIN students s ON c.student_id = s.id
    `;
    let params = [];

    if (status) {
        query += ' WHERE c.status = ?';
        params.push(status);
    }

    query += ' ORDER BY c.created_at DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// =============================================
// NOTICE ROUTES
// =============================================

// Create notice
app.post('/api/notices', authenticateToken, [
    body('title').notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, target_audience, block_id, priority, expires_at } = req.body;

    db.run(
        `INSERT INTO notices 
         (title, content, target_audience, block_id, priority, expires_at, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, content, target_audience || 'all', block_id, priority || 'normal', expires_at, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to create notice' });
            }
            
            db.get(
                `SELECT n.*, u.username as created_by_name 
                 FROM notices n
                 LEFT JOIN users u ON n.created_by = u.id
                 WHERE n.id = ?`,
                [this.lastID],
                (err, row) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to retrieve notice' });
                    }
                    res.status(201).json(row);
                }
            );
        }
    );
});

// Get notices
app.get('/api/notices', authenticateToken, (req, res) => {
    db.all(
        `SELECT n.*, u.username as created_by_name 
         FROM notices n
         LEFT JOIN users u ON n.created_by = u.id
         WHERE n.expires_at IS NULL OR n.expires_at > datetime('now')
         ORDER BY n.priority DESC, n.created_at DESC
         LIMIT 50`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// =============================================
// DASHBOARD STATS
// =============================================

app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
    const queries = {
        totalStudents: 'SELECT COUNT(*) as count FROM students',
        activeAllocations: 'SELECT COUNT(*) as count FROM room_allocations WHERE status = "active"',
        totalRooms: 'SELECT COUNT(*) as count FROM rooms',
        availableRooms: 'SELECT COUNT(*) as count FROM rooms WHERE current_occupancy < capacity',
        pendingMaintenance: 'SELECT COUNT(*) as count FROM maintenance_requests WHERE status = "pending"',
        pendingComplaints: 'SELECT COUNT(*) as count FROM complaints WHERE status = "pending"',
        todayPayments: 'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_date = date("now") AND status = "paid"',
        totalBlocks: 'SELECT COUNT(*) as count FROM hostel_blocks'
    };

    const result = {};

    let completed = 0;
    const totalQueries = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, sql]) => {
        db.get(sql, (err, row) => {
            if (err) {
                console.error(`Error fetching ${key}:`, err);
                result[key] = 0;
            } else {
                result[key] = row ? Object.values(row)[0] : 0;
            }
            completed++;
            if (completed === totalQueries) {
                res.json(result);
            }
        });
    });
});

// =============================================
// START SERVER
// =============================================
app.listen(PORT, () => {
    console.log('=' .repeat(50));
    console.log('🏨 RAVITEC HOSTEL MANAGEMENT SYSTEM');
    console.log('=' .repeat(50));
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: ravitec_hmis.db`);
    console.log('=' .repeat(50));
    console.log('📋 Available Endpoints:');
    console.log('  🔐 Auth: /api/login, /api/register');
    console.log('  🏢 Blocks: /api/blocks');
    console.log('  🚪 Rooms: /api/rooms');
    console.log('  👨‍🎓 Students: /api/students');
    console.log('  📋 Allocations: /api/allocations');
    console.log('  💰 Payments: /api/payments');
    console.log('  🍽️  Mess: /api/mess');
    console.log('  🔧 Maintenance: /api/maintenance');
    console.log('  📢 Complaints: /api/complaints');
    console.log('  📰 Notices: /api/notices');
    console.log('  📊 Dashboard: /api/dashboard/stats');
    console.log('=' .repeat(50));
});