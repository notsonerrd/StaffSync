import "./App.css";
import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import {
  Users, Calendar, Clock, LogOut, Plus, Trash2, Check, X,
  LayoutDashboard, Megaphone, CheckCircle, Search, UserPlus, Send, GraduationCap,
} from "lucide-react";

const API = process.env.REACT_APP_API_URL || "http://localhost:3000/api";
/* ==========================================
   LOCAL STORAGE & API WRAPPER UTILS
   ========================================== */
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

// Reads the body as text first, so an empty / non-JSON reply never crashes with
// "Unexpected end of JSON input".
async function api(path, { method = "GET", body } = {}) {
  const token = store.get("ss_token");
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. It may be waking up, wait 30 seconds and try again.");
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text }; }
  }

  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Backend may reply with an array or { data: [...] }
const toList = (r) => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []);

// Backend sends "admin" (or "hr"); both get admin powers in the UI.
const isAdmin = (u) => ["admin", "hr"].includes(String(u?.role || "").toLowerCase());
const norm = (s) => String(s || "").toLowerCase();
// Reads the payload of a JWT (id, role, ...) without any library.
function decodeJwt(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch {
    return null;
  }
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "–");

/* ==========================================
   AUTHENTICATION CONTEXT
   ========================================== */
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => store.get("ss_user"));
  const [token, setToken] = useState(() => store.get("ss_token"));

  const login = (u, t) => {
    setUser(u);
    setToken(t);
    store.set("ss_user", u);
    if (t) store.set("ss_token", t);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    store.del("ss_user");
    store.del("ss_token");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ==========================================
   SIDEBAR NAVIGATION COMPONENT
   ========================================== */
function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Employees", path: "/employees", icon: Users },
    { name: "Attendance", path: "/attendance", icon: Clock },
    { name: "Leaves", path: "/leaves", icon: Calendar },
    { name: "Announcements", path: "/announcements", icon: Megaphone },
    { name: "Training", path: "/training", icon: GraduationCap },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-badge">S</div>
        <h2>StaffSync</h2>
      </div>

      <nav className="sidebar-menu">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={`nav-link ${isActive ? "active" : ""}`}>
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar">{user?.name ? user.name.charAt(0).toUpperCase() : "U"}</div>
          <div className="user-info">
            <span className="user-name">{user?.name || "User"}</span>
            <span className="user-role">{user?.role || "employee"}</span>
          </div>
        </div>
        <button onClick={logout} className="logout-btn" title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}

/* ==========================================
   LOGIN PAGE COMPONENT
   ========================================== */
function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Render free servers sleep; the first calls can come back empty while waking up.
    // So we retry a few times automatically before giving up.
    const MAX_TRIES = 5;
    let lastErr = null;
    for (let i = 1; i <= MAX_TRIES; i++) {
      try {
        const data = await api("/auth/login", { method: "POST", body: { email, password } });
        let u = data?.user || data?.data?.user || data?.employee || data?.data?.employee;
        const t = data?.token || data?.data?.token || data?.accessToken;
        // Backend sends only { token }: build the user from the token + profile.
        if (!u && t) {
          const p = decodeJwt(t) || {};
          const nice = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          u = { id: p.id, role: p.role || "employee", email, name: p.name || nice };
          store.set("ss_token", t);
          try {
            const prof = await api("/profile");
            const pd = prof?.data || prof;
            if (pd && typeof pd === "object" && pd.name) u = { ...u, ...pd, role: pd.role || u.role };
          } catch {}
        }
        if (u) {
          login(u, t);
          setLoading(false);
          return;
        }
        lastErr = new Error(data ? "Login reply has no user: " + JSON.stringify(data).slice(0, 120) : "Server sent an empty response.");
      } catch (err) {
        // wrong password etc. should not be retried
        if (err.status === 400 || err.status === 401 || err.status === 403) {
          setError(err.message);
          setLoading(false);
          return;
        }
        lastErr = err;
      }
      if (i < MAX_TRIES) {
        setError(`Server is waking up, retrying (${i}/${MAX_TRIES - 1})...`);
        await new Promise((r) => setTimeout(r, 8000));
      }
    }
    setError(lastErr?.message || "Login failed. Please try again.");
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-banner">
        <div className="banner-header">
          <div className="logo-badge dark">S</div>
          <span>StaffSync HR</span>
        </div>
        <h1>Streamline your workforce in one portal.</h1>
        <p>Real-time attendance tracking, seamless leave management, and employee directories.</p>
        <div className="banner-image-wrapper">
          <img
            src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80"
            alt="Office workspace"
          />
        </div>
      </div>

      <div className="login-form-area">
        <div className="form-card">
          <div className="form-header">
            <div className="logo-badge">S</div>
            <h2>StaffSync</h2>
            <h3>Welcome back</h3>
            <p>Enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Work Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sana@staffsync.io" />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            {error && <div className="error-alert">{error}</div>}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Signing in..." : "Sign in to Dashboard"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ==========================================
   DASHBOARD OVERVIEW COMPONENT
   ========================================== */
function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ employeesCount: 0, pendingLeaves: 0 });
  const [announcements, setAnnouncements] = useState([]);
  const attendance = store.get("ss_att") || [];
  const today = new Date().toLocaleDateString();
  const presentToday = attendance.some((a) => a.date === today);

  useEffect(() => {
    async function loadDashboardData() {
      const [emp, leaves, ann] = await Promise.all([
        api("/employees").catch(() => []),
        api("/leaves").catch(() => []),
        api("/announcements").catch(() => []),
      ]);
      setStats({
        employeesCount: toList(emp).length,
        pendingLeaves: toList(leaves).filter((l) => norm(l.status) === "pending").length,
      });
      setAnnouncements(toList(ann).slice(0, 3));
    }
    loadDashboardData();
  }, []);

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Good day, {user?.name || "User"}</h1>
        <p>Welcome to your HR management overview.</p>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>Total Team Members</span>
            <Users className="stat-icon" size={20} />
          </div>
          <span className="stat-value">{stats.employeesCount}</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span>Pending Leave Applications</span>
            <Calendar className="stat-icon" size={20} />
          </div>
          <span className="stat-value">{stats.pendingLeaves}</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span>Attendance Status Today</span>
            <Clock className="stat-icon" size={20} />
          </div>
          <span className="stat-value">{presentToday ? "Present" : "Not Marked"}</span>
        </div>
      </div>

      <section className="dashboard-section">
        <h3>Recent Company Announcements</h3>
        {announcements.length === 0 ? (
          <div className="empty-card"><p>No announcements posted yet.</p></div>
        ) : (
          <div className="cards-grid">
            {announcements.map((item, idx) => (
              <div key={item._id || idx} className="info-card">
                <h4>{item.title}</h4>
                <p>{item.content || item.body}</p>
                <small>{fmtDate(item.createdAt || item.date)}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ==========================================
   EMPLOYEES MANAGEMENT COMPONENT
   ========================================== */
const EMPTY_EMP = { name: "", email: "", role: "employee", department: "Engineering" };

function Employees() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_EMP);
  const [loading, setLoading] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      setEmployees(toList(await api("/employees")));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/employees", { method: "POST", body: { ...form, position: form.department, password: "admin123" } });
      setShowModal(false);
      setForm(EMPTY_EMP);
      fetchEmployees();
    } catch (err) {
      alert(err.message || "Failed to add employee");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this employee?")) return;
    try {
      await api(`/employees/${id}`, { method: "DELETE" });
      fetchEmployees();
    } catch (err) {
      alert(err.message || "Failed to delete employee");
    }
  };

  const filtered = employees.filter(
    (e) =>
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <header className="page-header flex-between">
        <div>
          <h1>Employees Directory</h1>
          <p>Manage employee records, roles, and departmental access.</p>
        </div>
        {admin && (
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <UserPlus size={18} /> Add Employee
          </button>
        )}
      </header>

      <div className="toolbar">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search employees by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              {admin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="5" className="text-center">No employees found.</td></tr>
            ) : (
              filtered.map((emp) => (
                <tr key={emp._id || emp.email}>
                  <td className="font-medium">
                    <div className="flex-align gap-2">
                      <div className="avatar-sm">{emp.name?.charAt(0).toUpperCase()}</div>
                      {emp.name}
                    </div>
                  </td>
                  <td>{emp.email}</td>
                  <td>
                    <span className={`badge ${isAdmin(emp) ? "badge-admin" : "badge-emp"}`}>{emp.role}</span>
                  </td>
                  <td>{emp.department || "General"}</td>
                  {admin && (
                    <td>
                      <button className="btn-danger-icon" onClick={() => handleDelete(emp._id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add New Employee</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEmployee}>
              <div className="form-group">
                <label>Full Name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@staffsync.io" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Department</label>
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Engineering" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Saving..." : "Create Employee"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================
   ATTENDANCE MANAGEMENT COMPONENT
   ========================================== */
function Attendance() {
  const [logs, setLogs] = useState(() => store.get("ss_att") || []);
  const today = new Date().toLocaleDateString();
  const todayLog = logs.find((l) => l.date === today);
  const checkedIn = !!todayLog && todayLog.checkOut === "--";

  const save = (next) => {
    setLogs(next);
    store.set("ss_att", next);
  };

  const handleCheckIn = () => {
    save([{ date: today, status: "Present", checkIn: new Date().toLocaleTimeString(), checkOut: "--" }, ...logs]);
  };

  const handleCheckOut = () => {
    save(logs.map((l) => (l.date === today && l.checkOut === "--" ? { ...l, checkOut: new Date().toLocaleTimeString() } : l)));
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Attendance Tracking</h1>
        <p>Log your daily working hours and review time history.</p>
      </header>

      <div className="card-box flex-between flex-align">
        <div>
          <h3>Today's Shift Status</h3>
          <p>{checkedIn ? `Checked in at ${todayLog.checkIn}` : todayLog ? "Shift completed for today." : "You haven't checked in yet today."}</p>
        </div>
        <div>
          {!todayLog && (
            <button className="btn-success" onClick={handleCheckIn}>
              <CheckCircle size={18} /> Clock In Now
            </button>
          )}
          {checkedIn && (
            <button className="btn-warning" onClick={handleCheckOut}>
              <Clock size={18} /> Clock Out
            </button>
          )}
        </div>
      </div>

      <div className="section-title mt-6">
        <h3>Attendance Logs</h3>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Check In Time</th>
              <th>Check Out Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan="4" className="text-center">No attendance recorded yet.</td></tr>
            ) : (
              logs.map((log, i) => (
                <tr key={i}>
                  <td>{log.date}</td>
                  <td><span className="badge badge-success">{log.status}</span></td>
                  <td>{log.checkIn}</td>
                  <td>{log.checkOut}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==========================================
   LEAVES MANAGEMENT COMPONENT
   ========================================== */
const EMPTY_LEAVE = { reason: "", startDate: "", endDate: "", type: "Casual" };

function Leaves() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [leaves, setLeaves] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_LEAVE);

  const fetchLeaves = useCallback(async () => {
    try {
      setLeaves(toList(await api("/leaves")));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      // both field spellings are sent so it works with either backend schema
      await api("/leaves", {
        method: "POST",
        body: { ...form, from: form.startDate, to: form.endDate, employee: user?.name, status: "Pending" },
      });
      setShowModal(false);
      setForm(EMPTY_LEAVE);
      fetchLeaves();
    } catch (err) {
      alert(err.message || "Failed to apply leave");
    }
  };

  const handleStatusChange = async (id, status) => {
    const body = { status };
    try {
      try {
        await api(`/leaves/${id}`, { method: "PUT", body });
      } catch (err) {
        if (err.status === 404 || err.status === 405) await api(`/leaves/${id}`, { method: "PATCH", body });
        else throw err;
      }
      fetchLeaves();
    } catch (err) {
      alert(err.message || "Status update failed");
    }
  };

  return (
    <div className="page-container">
      <header className="page-header flex-between">
        <div>
          <h1>Leave Management</h1>
          <p>Apply for leaves and track request approvals.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Apply Leave
        </button>
      </header>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {admin && <th>Employee</th>}
              <th>Type</th>
              <th>Reason</th>
              <th>Dates</th>
              <th>Status</th>
              {admin && <th>Approve / Reject</th>}
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <tr><td colSpan="6" className="text-center">No leave requests found.</td></tr>
            ) : (
              leaves.map((l, i) => (
                <tr key={l._id || i}>
                  {admin && <td>{l.employee || "–"}</td>}
                  <td className="font-medium">{l.type || "Sick"}</td>
                  <td>{l.reason}</td>
                  <td>{fmtDate(l.startDate || l.from)} to {fmtDate(l.endDate || l.to)}</td>
                  <td><span className={`badge badge-${norm(l.status)}`}>{l.status}</span></td>
                  {admin && (
                    <td>
                      {norm(l.status) === "pending" && (
                        <div className="flex-align gap-2">
                          <button className="btn-success-sm" onClick={() => handleStatusChange(l._id, "Approved")}>
                            <Check size={16} />
                          </button>
                          <button className="btn-danger-sm" onClick={() => handleStatusChange(l._id, "Rejected")}>
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Apply for Leave</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleApplyLeave}>
              <div className="form-group">
                <label>Leave Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="Casual">Casual Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Annual">Annual Leave</option>
                  <option value="Unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <textarea required rows="3" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason for leave..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Submit Application</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================
   ANNOUNCEMENTS COMPONENT
   ========================================== */
function Announcements() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [announcements, setAnnouncements] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const fetchAnnouncements = useCallback(async () => {
    try {
      setAnnouncements(toList(await api("/announcements")));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handlePost = async (e) => {
    e.preventDefault();
    try {
      await api("/announcements", {
        method: "POST",
        body: { title, content, body: content, author: user?.name, date: new Date().toISOString() },
      });
      setTitle("");
      setContent("");
      fetchAnnouncements();
    } catch (err) {
      alert(err.message || "Failed to post announcement");
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Company Announcements</h1>
        <p>Stay informed on upcoming events and official updates.</p>
      </header>

      {admin && (
        <div className="card-box mb-6">
          <h3>Post New Announcement</h3>
          <form onSubmit={handlePost} className="mt-4">
            <div className="form-group">
              <label>Title</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Town Hall Meeting Scheduled" />
            </div>
            <div className="form-group">
              <label>Message Content</label>
              <textarea required rows="3" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Announcement details..." />
            </div>
            <button type="submit" className="btn-primary">
              <Send size={16} /> Publish Announcement
            </button>
          </form>
        </div>
      )}

      <div className="announcements-list">
        {announcements.length === 0 ? (
          <div className="empty-card"><p>No announcements posted yet.</p></div>
        ) : (
          announcements.map((ann, i) => (
            <div key={ann._id || i} className="card-box mb-4">
              <div className="flex-between">
                <h3>{ann.title}</h3>
                <small className="text-muted">{fmtDate(ann.createdAt || ann.date)}</small>
              </div>
              <p className="mt-2 text-secondary">{ann.content || ann.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ==========================================
   LAYOUT WRAPPER & ROUTING
   ========================================== */
function Layout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

/* ==========================================
   TRAINING & DEVELOPMENT COMPONENT
   ========================================== */
const EMPTY_TRAINING = { title: "", description: "", trainer: "", team: "All Teams", mode: "Online", startDate: "", endDate: "" };
const TEAMS = ["All Teams", "Engineering", "HR", "Sales", "Marketing", "Finance", "Support"];

function Training() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_TRAINING);

  const fetchTrainings = useCallback(async () => {
    try {
      setItems(toList(await api("/trainings")));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchTrainings();
  }, [fetchTrainings]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api("/trainings", { method: "POST", body: form });
      setShowModal(false);
      setForm(EMPTY_TRAINING);
      fetchTrainings();
    } catch (err) {
      alert(err.message || "Failed to create training");
    }
  };

  const handleEnroll = async (id) => {
    try {
      await api(`/trainings/${id}/enroll`, { method: "POST" });
      fetchTrainings();
    } catch (err) {
      alert(err.message || "Failed to update enrollment");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this training program?")) return;
    try {
      await api(`/trainings/${id}`, { method: "DELETE" });
      fetchTrainings();
    } catch (err) {
      alert(err.message || "Failed to delete training");
    }
  };

  return (
    <div className="page-container">
      <header className="page-header flex-between">
        <div>
          <h1>Training & Development</h1>
          <p>Upskilling programs for teams. Enroll and grow your skills.</p>
        </div>
        {admin && (
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> New Program
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="empty-card"><p>No training programs yet.</p></div>
      ) : (
        <div className="cards-grid">
          {items.map((t) => (
            <div key={t._id} className="info-card">
              <div className="flex-between">
                <h4>{t.title}</h4>
                <span className="badge badge-emp">{t.team}</span>
              </div>
              <p>{t.description || "No description."}</p>
              <p><strong>Trainer:</strong> {t.trainer} &nbsp;|&nbsp; <strong>Mode:</strong> {t.mode}</p>
              <p><strong>Dates:</strong> {fmtDate(t.startDate)} to {fmtDate(t.endDate)}</p>
              <p><strong>Enrolled:</strong> {t.enrolledCount}</p>
              {admin && t.participants?.length > 0 && (
                <small>Participants: {t.participants.map((p) => p.name).join(", ")}</small>
              )}
              <div className="flex-align gap-2 mt-4">
                <button className={t.isEnrolled ? "btn-secondary" : "btn-success"} onClick={() => handleEnroll(t._id)}>
                  {t.isEnrolled ? "Leave Program" : "Enroll Now"}
                </button>
                {admin && (
                  <button className="btn-danger-icon" onClick={() => handleDelete(t._id)}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>New Training Program</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Program Title</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. React Advanced Workshop" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will be covered..." />
              </div>
              <div className="form-group">
                <label>Trainer</label>
                <input value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} placeholder="Trainer name" />
              </div>
              <div className="form-group">
                <label>Team</label>
                <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
                  {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Mode</label>
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Program</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
          <Route path="/leaves" element={<ProtectedRoute><Leaves /></ProtectedRoute>} />
          <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
          <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}