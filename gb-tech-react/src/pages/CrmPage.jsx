import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, formatCurrency, statusClass } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { Link, navigate, useBodyClass, usePageTitle } from "../lib/router.jsx";
import { prefersReducedMotion } from "../lib/motion.js";
import { AnimatedNumber } from "../components/motion.jsx";
import { useToast } from "../components/Toast.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

const VIEWS = [
  ["overview", "Overview"],
  ["leads", "Leads"],
  ["employees", "Employees"],
  ["tasks", "Tasks"],
  ["enquiries", "Enquiries"],
];
const HASH_TO_VIEW = { overview: "overview", leads: "leads", employees: "employees", students: "employees", tasks: "tasks", enquiries: "enquiries" };
const STATUSES = ["New", "Contacted", "Qualified", "Proposal", "Closed"];
const EMPLOYEE_STATUSES = ["Active", "On leave", "Inactive"];
const TASK_STATUSES = ["Open", "In Progress", "Completed"];

function formatRecordDate(value) {
  if (!value) return "Date not set";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const subscribeHash = (listener) => {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
};
const useCurrentView = () => {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash.replace("#", ""));
  return HASH_TO_VIEW[hash || "overview"] || "overview";
};

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Shows the first five records, like the previous version of the CRM
function AdminList({ id, loaded, items, empty, loading, render }) {
  return (
    <div id={id} className="admin-list">
      {!loaded ? loading : items.length ? items.slice(0, 5).map(render) : <p>{empty}</p>}
    </div>
  );
}

function CrmWorkspace() {
  const { logout } = useAuth();
  const toast = useToast();
  const view = useCurrentView();

  const [summary, setSummary] = useState({ leads: 0, qualified: 0, revenue: 0, employees: 0, open_tasks: 0, loaded: false });
  const [leads, setLeads] = useState([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [employeeFilters, setEmployeeFilters] = useState({ q: "", department: "" });
  const [taskFilters, setTaskFilters] = useState({ q: "", status: "" });
  const [records, setRecords] = useState({ employees: [], tasks: [], enquiries: [], loaded: false });
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [refreshing, setRefreshing] = useState("");
  const [leavingId, setLeavingId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const leadForm = useRef(null);
  const requestId = useRef(0);
  const firstRows = useRef(null); // id -> index of the rows that animate in on first load
  const query = useDebounced(filters.q, 200);

  // A 401 means the session ended, so send the person back to sign in
  const handleError = useCallback((error) => {
    if (error.status === 401) navigate("/admin-login", { replace: true });
    return error;
  }, []);

  const loadSummary = useCallback(async () => {
    const data = await api("/api/admin/summary");
    setSummary({ ...data, loaded: true });
  }, []);

  const loadLeads = useCallback(async () => {
    const id = ++requestId.current;
    const params = new URLSearchParams({ q: query, status: filters.status });
    const { leads: rows } = await api(`/api/admin/leads?${params}`);
    if (id !== requestId.current) return; // a newer search already replaced this one
    if (firstRows.current === null) firstRows.current = new Map(rows.map((lead, index) => [lead.id, Math.min(index, 12)]));
    setLeads(rows);
    setLeadsLoaded(true);
  }, [query, filters.status]);

  const loadEmployees = useCallback(async () => {
    const { employees } = await api("/api/admin/employees");
    setRecords((current) => ({ ...current, employees }));
  }, []);

  const loadTasks = useCallback(async () => {
    const { tasks } = await api("/api/admin/tasks");
    setRecords((current) => ({ ...current, tasks }));
  }, []);

  useEffect(() => {
    loadSummary().catch((error) => {
      handleError(error);
      toast(error.message, "error");
    });
  }, [loadSummary, handleError, toast]);
  useEffect(() => {
    loadLeads().catch((error) => {
      handleError(error);
      toast(error.message, "error");
    });
  }, [loadLeads, handleError, toast]);
  useEffect(() => {
    Promise.all([api("/api/admin/employees"), api("/api/admin/tasks"), api("/api/admin/enquiries")])
      .then(([employees, tasks, enquiries]) => setRecords({
        employees: employees.employees,
        tasks: tasks.tasks,
        enquiries: enquiries.enquiries,
        loaded: true,
      }))
      .catch((error) => {
        handleError(error);
        toast(error.message, "error");
      });
  }, [handleError, toast]);

  async function handleAddLead(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await api("/api/admin/leads", { method: "POST", body: JSON.stringify({ ...data, value: Number(data.value || 0) }) });
      form.reset();
      await Promise.all([loadLeads(), loadSummary()]);
      toast("Lead added.");
    } catch (error) {
      handleError(error);
      toast(error.message, "error");
    }
  }

  async function handleAddEmployee(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setBusyId("employee-create");
    try {
      await api("/api/admin/employees", { method: "POST", body: JSON.stringify(data) });
      form.reset();
      setEmployeeFormOpen(false);
      await Promise.all([loadEmployees(), loadSummary()]);
      toast("Employee added to the directory.");
    } catch (error) {
      handleError(error);
      toast(error.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleEmployeeStatus(employeeId, status) {
    setBusyId(`employee-${employeeId}`);
    try {
      await api(`/api/admin/employees/${employeeId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await Promise.all([loadEmployees(), loadSummary()]);
      toast("Employee status updated.");
    } catch (error) {
      handleError(error);
      toast(error.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddTask(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setBusyId("task-create");
    try {
      await api("/api/admin/tasks", { method: "POST", body: JSON.stringify(data) });
      form.reset();
      setTaskFormOpen(false);
      await Promise.all([loadTasks(), loadSummary()]);
      toast("Task created.");
    } catch (error) {
      handleError(error);
      toast(error.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTaskStatus(taskId, status) {
    setBusyId(`task-${taskId}`);
    try {
      await api(`/api/admin/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await Promise.all([loadTasks(), loadSummary()]);
      toast("Task status updated.");
    } catch (error) {
      handleError(error);
      toast(error.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRefresh(viewName) {
    setRefreshing(viewName);
    try {
      if (viewName === "employees") await loadEmployees();
      else if (viewName === "tasks") await loadTasks();
      toast(`${viewName === "employees" ? "Employees" : "Tasks"} refreshed.`);
    } catch (error) {
      handleError(error);
      toast(error.message, "error");
    } finally {
      setRefreshing("");
    }
  }

  async function handleDelete(id) {
    setBusyId(id);
    try {
      await api(`/api/admin/leads/${id}`, { method: "DELETE" });
      setLeavingId(id);
      if (!prefersReducedMotion()) await wait(220);
      await Promise.all([loadLeads(), loadSummary()]);
      toast("Lead deleted.");
    } catch (error) {
      handleError(error);
      toast(error.message, "error");
    } finally {
      setBusyId(null);
      setLeavingId(null);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/admin-login");
  }

  const rate = summary.leads ? Math.round((summary.qualified / summary.leads) * 100) : 0;
  const employeeDepartments = [...new Set(records.employees.map((employee) => employee.department).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const filteredEmployees = records.employees.filter((employee) => {
    const queryText = employeeFilters.q.trim().toLowerCase();
    const matchesQuery = !queryText || [
      employee.full_name,
      employee.email,
      employee.title,
      employee.department,
      employee.phone,
    ].some((value) => String(value || "").toLowerCase().includes(queryText));
    const matchesDepartment = !employeeFilters.department || employee.department === employeeFilters.department;
    return matchesQuery && matchesDepartment;
  });
  const employeeMetrics = [
    { label: "Team members", value: records.employees.length, detail: "In the directory", tone: "total" },
    { label: "Active", value: records.employees.filter((employee) => employee.status === "Active").length, detail: "Currently active", tone: "approved" },
    { label: "On leave", value: records.employees.filter((employee) => employee.status === "On leave").length, detail: "Temporarily away", tone: "review" },
    { label: "Departments", value: employeeDepartments.length, detail: "Across the team", tone: "total" },
  ];
  const filteredTasks = records.tasks.filter((task) => {
    const queryText = taskFilters.q.trim().toLowerCase();
    const matchesQuery = !queryText || [task.title, task.assignee].some((value) => String(value || "").toLowerCase().includes(queryText));
    const matchesStatus = !taskFilters.status || task.status === taskFilters.status;
    return matchesQuery && matchesStatus;
  });
  const today = getLocalDateString();
  const isTaskComplete = (task) => ["completed", "complete", "done"].includes(String(task.status || "").toLowerCase());
  const overdueTasks = records.tasks.filter((task) => !isTaskComplete(task) && task.due_date < today);
  const taskMetrics = [
    { label: "All tasks", value: records.tasks.length, detail: "In the work queue", tone: "total" },
    { label: "Open", value: records.tasks.filter((task) => String(task.status || "").toLowerCase() === "open").length, detail: "Ready to start", tone: "review" },
    { label: "In progress", value: records.tasks.filter((task) => String(task.status || "").toLowerCase() === "in progress").length, detail: "Currently underway", tone: "approved" },
    { label: "Overdue", value: overdueTasks.length, detail: "Need attention", tone: "declined" },
  ];
  const taskStatuses = [...new Set([...TASK_STATUSES, ...records.tasks.map((task) => task.status).filter(Boolean)])];
  const viewClass = (name) => `crm-view${view === name ? " is-active" : ""}`;

  return (
    <div className="crm-shell">
      <aside className="crm-sidebar">
        <div className="brand sidebar-brand">
          <img className="brand-mark" src="/images/gb-tech-logo.png" alt="" />
          <div>
            <strong>GB Tech Corp</strong>
            <span>CRM Center</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="CRM navigation">
          {VIEWS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={view === id ? "active" : undefined}>{label}</a>
          ))}
        </nav>

        <div className="sidebar-card crm-operations-card">
          <p>Operations snapshot</p>
          <strong>{summary.loaded ? summary.open_tasks : "—"} open tasks</strong>
          <span>{summary.loaded ? `${summary.employees} active team members` : "Loading team metrics…"}</span>
        </div>
      </aside>

      <main className="crm-main">
        <header className="crm-header">
          <div>
            <span className="eyebrow accent">Admin workspace</span>
            <h1>Customer &amp; operations CRM</h1>
          </div>
          <div className="header-actions">
            <Link className="btn btn-secondary" to="/">Back to Website</Link>
            <ThemeToggle />
            <button className="btn btn-primary" type="button" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <section className={viewClass("overview")}>
          <div className="top-metrics" id="overview">
            <div className="metric-box"><span>Total leads</span><strong><AnimatedNumber value={summary.leads} /></strong></div>
            <div className="metric-box"><span>Qualified</span><strong><AnimatedNumber value={summary.qualified} /></strong></div>
            <div className="metric-box"><span>Pipeline value</span><strong><AnimatedNumber value={summary.revenue} format={formatCurrency} /></strong></div>
            <div className="metric-box"><span>Open tasks</span><strong><AnimatedNumber value={summary.open_tasks} /></strong></div>
          </div>

          <div className="pipeline-panel" aria-labelledby="pipelineTitle">
            <div className="pipeline-heading">
              <div>
                <span className="panel-kicker">Live pipeline</span>
                <h2 id="pipelineTitle">Lead qualification</h2>
              </div>
              <strong>{summary.loaded ? `${rate}%` : "—"}</strong>
            </div>
            <div
              className="qualification-chart"
              role="img"
              aria-label={summary.loaded ? `${summary.qualified} of ${summary.leads} leads are qualified` : "Lead qualification data is loading"}
            >
              <span className="qualified-chart-fill" style={{ width: `${summary.loaded ? rate : 0}%` }} />
            </div>
            <div className="chart-legend">
              <span><i className="legend-dot qualified-dot" /><span>Qualified {summary.loaded ? summary.qualified : "—"}</span></span>
              <span><i className="legend-dot other-dot" /><span>Other leads {summary.loaded ? summary.leads - summary.qualified : "—"}</span></span>
            </div>
          </div>
        </section>

        <section className={viewClass("leads")}>
          <div className="crm-content">
            <div className="form-panel">
              <div className="panel-head"><h2>Add New Lead</h2></div>
              <form id="leadForm" ref={leadForm} onSubmit={handleAddLead}>
                <div className="form-grid">
                  <label>Full name<input type="text" name="name" placeholder="Jane Smith" required /></label>
                  <label>Company<input type="text" name="company" placeholder="Acme Ltd" required /></label>
                  <label>Email<input type="email" name="email" placeholder="jane@acme.com" required /></label>
                  <label>Phone<input type="tel" name="phone" placeholder="+1 (555) 123-4567" required /></label>
                  <label>
                    Status
                    <select name="status" defaultValue="New">
                      {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label>Value ($)<input type="number" name="value" min="0" step="100" defaultValue="2500" required /></label>
                  <label>
                    Source
                    <select name="source" defaultValue="Website">
                      {["Website", "Referral", "LinkedIn", "Event", "Cold Call"].map((source) => <option key={source} value={source}>{source}</option>)}
                    </select>
                  </label>
                  <label>Assigned to<input type="text" name="owner" placeholder="Sarah" required /></label>
                </div>
                <button type="submit" className="btn btn-primary full-width">Add Lead</button>
              </form>
            </div>

            <div className="table-panel">
              <div className="panel-head with-search">
                <h2>Recent Leads</h2>
                <div className="table-filters">
                  <input
                    type="search"
                    placeholder="Search leads..."
                    value={filters.q}
                    onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                  />
                  <select
                    aria-label="Filter leads by status"
                    value={filters.status}
                    onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option value="">All statuses</option>
                    {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Name</th><th>Company</th><th>Status</th><th>Value</th><th>Owner</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {leads.length ? leads.map((lead) => {
                      const enterIndex = prefersReducedMotion() ? undefined : firstRows.current?.get(lead.id);
                      return (
                        <tr
                          key={lead.id}
                          className={[enterIndex !== undefined && "row-enter", leavingId === lead.id && "row-leaving"].filter(Boolean).join(" ") || undefined}
                          style={enterIndex !== undefined ? { "--i": enterIndex } : undefined}
                        >
                          <td><strong>{lead.name}</strong><br /><small>{lead.email}</small></td>
                          <td>{lead.company}</td>
                          <td><span className={`status-pill ${statusClass(lead.status)}`}>{lead.status}</span></td>
                          <td>{formatCurrency(lead.value)}</td>
                          <td>{lead.owner}</td>
                          <td>
                            <button className="table-action" type="button" disabled={busyId === lead.id} onClick={() => handleDelete(lead.id)}>Delete</button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={6}>{leadsLoaded ? "No leads match your filters." : "Loading leads..."}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className={viewClass("employees")}>
          <div className="operations-workspace">
            <section className="operations-intro">
              <div>
                <span className="panel-kicker">People operations</span>
                <h2>Employee directory</h2>
                <p>Keep team contacts, departments, and availability organized in one place.</p>
              </div>
              <div className="operations-intro-actions">
                <button className="operations-button secondary" type="button" onClick={() => handleRefresh("employees")} disabled={refreshing === "employees"}>
                  {refreshing === "employees" ? "Refreshing…" : "Refresh"}
                </button>
                <button className="operations-button primary" type="button" onClick={() => setEmployeeFormOpen((open) => !open)}>
                  {employeeFormOpen ? "Close form" : "Add employee"}
                </button>
              </div>
            </section>

            <div className="application-metrics" aria-label="Employee summary">
              {employeeMetrics.map((metric) => (
                <article className={`application-metric ${metric.tone}`} key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{records.loaded ? metric.value : "—"}</strong>
                  <small>{metric.detail}</small>
                </article>
              ))}
            </div>

            {employeeFormOpen && (
              <section className="operations-form-panel">
                <div className="application-section-heading">
                  <div>
                    <span className="panel-kicker">New team member</span>
                    <h3>Add employee details</h3>
                  </div>
                </div>
                <form className="operations-form-grid" onSubmit={handleAddEmployee}>
                  <label>Full name<input name="full_name" autoComplete="name" placeholder="Jordan Lee" required /></label>
                  <label>Work email<input name="email" type="email" autoComplete="email" placeholder="jordan@company.com" required /></label>
                  <label>Job title<input name="title" placeholder="Account Manager" required /></label>
                  <label>Department<input name="department" placeholder="Client Services" required /></label>
                  <label>Phone <span className="optional-label">(optional)</span><input name="phone" type="tel" autoComplete="tel" placeholder="+1 (555) 010-1234" /></label>
                  <label>Status<select name="status" defaultValue="Active">{EMPLOYEE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
                  <button className="operations-button primary operations-submit" type="submit" disabled={busyId === "employee-create"}>
                    {busyId === "employee-create" ? "Saving…" : "Save employee"}
                  </button>
                </form>
              </section>
            )}

            <section className="application-records" aria-labelledby="employeeDirectoryTitle">
              <div className="application-section-heading application-records-heading">
                <div>
                  <span className="panel-kicker">Team</span>
                  <h3 id="employeeDirectoryTitle">Directory</h3>
                </div>
                <span>{records.loaded ? `${filteredEmployees.length} shown` : "Loading"}</span>
              </div>
              <div className="application-filters">
                <label className="application-search">
                  <span className="sr-only">Search employees</span>
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    placeholder="Search name, role, email"
                    value={employeeFilters.q}
                    onChange={(event) => setEmployeeFilters((current) => ({ ...current, q: event.target.value }))}
                  />
                </label>
                <select
                  aria-label="Filter employees by department"
                  value={employeeFilters.department}
                  onChange={(event) => setEmployeeFilters((current) => ({ ...current, department: event.target.value }))}
                >
                  <option value="">All departments</option>
                  {employeeDepartments.map((department) => <option key={department}>{department}</option>)}
                </select>
                {(employeeFilters.q || employeeFilters.department) && (
                  <button className="application-clear-filters" type="button" onClick={() => setEmployeeFilters({ q: "", department: "" })}>Clear filters</button>
                )}
              </div>

              <div className="application-table-wrap">
                <table className="application-table">
                  <thead><tr><th>Employee</th><th>Department</th><th>Contact</th><th>Status</th></tr></thead>
                  <tbody>
                    {!records.loaded ? (
                      <tr><td className="application-table-message" colSpan={4}>Loading team directory…</td></tr>
                    ) : filteredEmployees.length ? filteredEmployees.map((employee) => (
                      <tr key={employee.id}>
                        <td>
                          <div className="application-applicant">
                            <span className="application-avatar" aria-hidden="true">{employee.full_name.trim().charAt(0).toUpperCase()}</span>
                            <span><strong>{employee.full_name}</strong><small>{employee.title}</small></span>
                          </div>
                        </td>
                        <td><span className="application-program">{employee.department}</span></td>
                        <td><span className="employee-contact">{employee.email}</span>{employee.phone && <small className="employee-phone">{employee.phone}</small>}</td>
                        <td>
                          <select
                            className={`employee-status-select ${statusClass(employee.status)}`}
                            aria-label={`Status for ${employee.full_name}`}
                            value={employee.status}
                            disabled={busyId === `employee-${employee.id}`}
                            onChange={(event) => handleEmployeeStatus(employee.id, event.target.value)}
                          >
                            {EMPLOYEE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                          </select>
                        </td>
                      </tr>
                    )) : (
                      <tr><td className="application-table-message" colSpan={4}>
                        {records.employees.length ? "No employees match these filters." : "Your employee directory is empty. Add your first team member to get started."}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>

        <section className={viewClass("tasks")}>
          <div className="operations-workspace">
            <section className="operations-intro">
              <div>
                <span className="panel-kicker">Work management</span>
                <h2>Team tasks</h2>
                <p>Assign follow-ups, keep due dates visible, and move work through to completion.</p>
              </div>
              <div className="operations-intro-actions">
                <button className="operations-button secondary" type="button" onClick={() => handleRefresh("tasks")} disabled={refreshing === "tasks"}>
                  {refreshing === "tasks" ? "Refreshing…" : "Refresh"}
                </button>
                <button className="operations-button primary" type="button" onClick={() => setTaskFormOpen((open) => !open)}>
                  {taskFormOpen ? "Close form" : "Create task"}
                </button>
              </div>
            </section>

            <div className="application-metrics" aria-label="Task summary">
              {taskMetrics.map((metric) => (
                <article className={`application-metric ${metric.tone}`} key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{records.loaded ? metric.value : "—"}</strong>
                  <small>{metric.detail}</small>
                </article>
              ))}
            </div>

            {taskFormOpen && (
              <section className="operations-form-panel">
                <div className="application-section-heading">
                  <div>
                    <span className="panel-kicker">Plan the work</span>
                    <h3>Create a task</h3>
                  </div>
                </div>
                <form className="operations-form-grid" onSubmit={handleAddTask}>
                  <label>Task title<input name="title" placeholder="Follow up with Acme Ltd" required /></label>
                  <label>Assigned to<input name="assignee" placeholder="Team member" required /></label>
                  <label>Due date<input name="due_date" type="date" min={today} required /></label>
                  <label>Status<select name="status" defaultValue="Open">{TASK_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
                  <button className="operations-button primary operations-submit" type="submit" disabled={busyId === "task-create"}>
                    {busyId === "task-create" ? "Saving…" : "Save task"}
                  </button>
                </form>
              </section>
            )}

            <section className="application-records" aria-labelledby="taskQueueTitle">
              <div className="application-section-heading application-records-heading">
                <div>
                  <span className="panel-kicker">Operations</span>
                  <h3 id="taskQueueTitle">Task queue</h3>
                </div>
                <span>{records.loaded ? `${filteredTasks.length} shown` : "Loading"}</span>
              </div>
              <div className="application-filters">
                <label className="application-search">
                  <span className="sr-only">Search tasks</span>
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    placeholder="Search task or assignee"
                    value={taskFilters.q}
                    onChange={(event) => setTaskFilters((current) => ({ ...current, q: event.target.value }))}
                  />
                </label>
                <select aria-label="Filter tasks by status" value={taskFilters.status} onChange={(event) => setTaskFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">All statuses</option>
                  {taskStatuses.map((status) => <option key={status}>{status}</option>)}
                </select>
                {(taskFilters.q || taskFilters.status) && (
                  <button className="application-clear-filters" type="button" onClick={() => setTaskFilters({ q: "", status: "" })}>Clear filters</button>
                )}
              </div>
              <div className="application-table-wrap">
                <table className="application-table task-table">
                  <thead><tr><th>Task</th><th>Assigned to</th><th>Due date</th><th>Status</th></tr></thead>
                  <tbody>
                    {!records.loaded ? (
                      <tr><td className="application-table-message" colSpan={4}>Loading tasks…</td></tr>
                    ) : filteredTasks.length ? filteredTasks.map((task) => {
                      const overdue = !isTaskComplete(task) && task.due_date < today;
                      return (
                        <tr key={task.id}>
                          <td><strong className="task-title">{task.title}</strong></td>
                          <td>{task.assignee}</td>
                          <td><span className={overdue ? "task-overdue" : ""}>{formatRecordDate(task.due_date)}{overdue && <small>Overdue</small>}</span></td>
                          <td>
                            <select
                              className={`task-status-select ${statusClass(task.status)}`}
                              aria-label={`Status for task ${task.title}`}
                              value={task.status}
                              disabled={busyId === `task-${task.id}`}
                              onChange={(event) => handleTaskStatus(task.id, event.target.value)}
                            >
                              {taskStatuses.map((status) => <option key={status}>{status}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td className="application-table-message" colSpan={4}>
                        {records.tasks.length ? "No tasks match these filters." : "No tasks yet. Create a task to give your team a clear next step."}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>

        <section className={viewClass("enquiries")}>
          <div className="page-panel">
            <div className="panel-head"><h2>Contact enquiries</h2><span className="panel-kicker">Inbox</span></div>
            <AdminList
              id="adminEnquiryList"
              loaded={records.loaded}
              items={records.enquiries}
              loading="Loading enquiries..."
              empty="No enquiries yet."
              render={(enquiry) => (
                <div className="admin-list-row" key={enquiry.id}>
                  <strong>{enquiry.subject}</strong>
                  <small>{enquiry.name} · {enquiry.status}</small>
                </div>
              )}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default function CrmPage() {
  useBodyClass("crm-page");
  usePageTitle("GB Tech Corp CRM");
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";

  // The server also protects every /api/admin route; this just avoids showing an empty shell
  useEffect(() => {
    if (!loading && !isAdmin) navigate("/admin-login", { replace: true });
  }, [loading, isAdmin]);

  if (loading || !isAdmin) return null;
  return <CrmWorkspace />;
}
