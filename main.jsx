import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LayoutDashboard,
  MapPinned,
  Car,
  History,
  Users,
  LogIn,
  ShieldCheck,
  Settings,
  Search,
  RefreshCw,
  LogOut,
  Plus,
  Download,
  MapPin,
  Camera,
  KeyRound,
  UserX,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  X,
} from "lucide-react";
import logo from "./mills-logo.svg";
import "./styles.css";
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
const norm = (s) =>
  String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
const csv = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
function FleetMap({ vehicles, selected, onSelect }) {
  const el = useRef(null),
    map = useRef(null),
    markers = useRef(new Map());
  useEffect(() => {
    map.current = L.map(el.current).setView([37.039, -76.397], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map.current);
    return () => map.current?.remove();
  }, []);
  useEffect(() => {
    markers.current.forEach((m) => m.remove());
    markers.current.clear();
    const b = [];
    vehicles
      .filter((v) => v.current_latitude != null)
      .forEach((v) => {
        const col = v.departments?.color || "#c51f2a",
          m = L.marker([v.current_latitude, v.current_longitude], {
            icon: L.divIcon({
              className: "pin",
              html: `<span style="background:${col}"></span>`,
              iconSize: [24, 32],
              iconAnchor: [12, 30],
            }),
          }).addTo(map.current);
        m.bindPopup(
          `<b>${v.stock_number || v.vin}</b><br>${[v.year, v.make, v.model].filter(Boolean).join(" ")}<br><small>${v.dealerships?.name || ""}<br>${v.departments?.name || ""} • ${v.zones?.name || "GPS location"}<br>${new Date(v.last_seen_at).toLocaleString()}</small>`,
        );
        m.on("click", () => onSelect(v.id));
        markers.current.set(v.id, m);
        b.push([v.current_latitude, v.current_longitude]);
      });
    if (b.length) map.current.fitBounds(b, { padding: [30, 30], maxZoom: 18 });
    setTimeout(() => map.current?.invalidateSize(), 50);
  }, [vehicles]);
  useEffect(() => {
    const m = markers.current.get(selected);
    if (m) {
      map.current.setView(m.getLatLng(), 19, { animate: true });
      m.openPopup();
    }
  }, [selected]);
  return <div className="fleet-map" ref={el} />;
}
function App() {
  const [user, setUser] = useState(null),
    [profile, setProfile] = useState(null),
    [tab, setTab] = useState("dashboard"),
    [data, setData] = useState({
      vehicles: [],
      movements: [],
      profiles: [],
      logins: [],
      audits: [],
      regions: [],
      campuses: [],
      dealers: [],
      departments: [],
      zones: [],
    }),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(null),
    [detail, setDetail] = useState(null),
    [modal, setModal] = useState(null),
    [msg, setMsg] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => data.session && enter(data.session.user));
    return supabase.auth.onAuthStateChange((_e, s) => !s && setUser(null)).data
      .subscription.unsubscribe;
  }, []);
  async function enter(u) {
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", u.id)
      .single();
    if (
      !p ||
      !p.active ||
      ![
        "supervisor",
        "dealership_admin",
        "campus_admin",
        "regional_admin",
        "corporate_admin",
        "system_admin",
      ].includes(p.role)
    ) {
      await supabase.auth.signOut();
      return setMsg({ bad: true, text: "Administrator access is required." });
    }
    setUser(u);
    setProfile(p);
    await supabase.from("login_events").insert({
      user_id: u.id,
      event: "success",
      user_agent: navigator.userAgent,
      session_id: crypto.randomUUID(),
    });
    loadAll();
  }
  async function loadAll() {
    setBusy(true);
    const q = await Promise.all([
      supabase
        .from("vehicles")
        .select(
          "*,departments:current_department_id(name,color),dealerships:current_dealership_id(name),campuses:current_campus_id(name),zones:current_zone_id(name),profiles:current_custodian_id(display_name)",
        )
        .order("last_seen_at", { ascending: false }),
      supabase
        .from("movements")
        .select(
          "*,vehicles(vin,stock_number,make,model),profiles:actor_id(display_name),departments:to_department_id(name,color),dealerships:to_dealership_id(name)",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("profiles")
        .select(
          "*,regions(name),campuses(name),dealerships(name),departments(name)",
        )
        .order("display_name"),
      supabase
        .from("login_events")
        .select("*,profiles(display_name,username)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("audit_logs")
        .select("*,profiles(display_name)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("regions").select("*").order("name"),
      supabase.from("campuses").select("*").order("name"),
      supabase.from("dealerships").select("*").order("name"),
      supabase.from("departments").select("*").order("name"),
      supabase
        .from("zones")
        .select("*,campuses(name),dealerships(name)")
        .order("name"),
    ]);
    setData({
      vehicles: q[0].data || [],
      movements: q[1].data || [],
      profiles: q[2].data || [],
      logins: q[3].data || [],
      audits: q[4].data || [],
      regions: q[5].data || [],
      campuses: q[6].data || [],
      dealers: q[7].data || [],
      departments: q[8].data || [],
      zones: q[9].data || [],
    });
    setBusy(false);
  }
  async function logout() {
    await supabase.from("login_events").insert({
      user_id: user.id,
      event: "logout",
      user_agent: navigator.userAgent,
    });
    await supabase.auth.signOut();
  }
  const vehicles = useMemo(
    () =>
      data.vehicles.filter(
        (v) =>
          !query ||
          [
            v.vin,
            v.stock_number,
            v.make,
            v.model,
            v.trim,
            v.color,
            v.interior_color,
            v.license_plate,
            v.packages,
            v.dealerships?.name,
            v.departments?.name,
            v.zones?.name,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [data.vehicles, query],
  );
  const active = data.vehicles.filter((v) => v.state === "on_campus").length,
    stale = data.vehicles.filter(
      (v) => Date.now() - new Date(v.last_seen_at) > 7 * 864e5,
    ).length;
  if (user && profile?.must_change_password)
    return (
      <ChangePassword
        onDone={() => setProfile({ ...profile, must_change_password: false })}
        setMsg={setMsg}
      />
    );
  async function showVehicle(v) {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase
        .from("movements")
        .select(
          "*,profiles:actor_id(display_name),departments:to_department_id(name,color),dealerships:to_dealership_id(name),zones:to_zone_id(name)",
        )
        .eq("vehicle_id", v.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("vehicle_photos")
        .select("*")
        .eq("vehicle_id", v.id)
        .order("created_at", { ascending: false }),
    ]);
    const photos = [];
    for (const x of p || []) {
      const { data: s } = await supabase.storage
        .from("vehicle-photos")
        .createSignedUrl(x.storage_path, 3600);
      photos.push({ ...x, url: s?.signedUrl });
    }
    setDetail({ vehicle: v, movements: m || [], photos });
  }
  function exportFleet() {
    const hs = [
      "VIN",
      "Stock",
      "Year",
      "Make",
      "Model",
      "Trim",
      "Colour",
      "Interior Colour",
      "License Plate",
      "Body Style",
      "Engine",
      "Drivetrain",
      "Transmission",
      "Fuel Type",
      "Packages",
      "Notes",
      "State",
      "Campus",
      "Dealership",
      "Department",
      "Zone",
      "Custodian",
      "Last Seen",
      "Latitude",
      "Longitude",
    ];
    const lines = [hs.map(csv).join(",")];
    data.vehicles.forEach((v) =>
      lines.push(
        [
          v.vin,
          v.stock_number,
          v.year,
          v.make,
          v.model,
          v.trim,
          v.color,
          v.interior_color,
          v.license_plate,
          v.body_style,
          v.engine,
          v.drivetrain,
          v.transmission,
          v.fuel_type,
          v.packages,
          v.notes,
          v.state,
          v.campuses?.name,
          v.dealerships?.name,
          v.departments?.name,
          v.zones?.name,
          v.profiles?.display_name,
          v.last_seen_at,
          v.current_latitude,
          v.current_longitude,
        ]
          .map(csv)
          .join(","),
      ),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([lines.join("\r\n")], { type: "text/csv" }),
    );
    a.download = "Mills-Campus-Inventory.csv";
    a.click();
  }
  if (!user) return <Login onSuccess={enter} msg={msg} setMsg={setMsg} />;
  const nav = [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["map", MapPinned, "Map"],
    ["vehicles", Car, "Vehicles"],
    ["movements", History, "Movements"],
    ["users", Users, "Users"],
    ["logins", LogIn, "Login log"],
    ["audit", ShieldCheck, "Audit log"],
    ["settings", Settings, "Configuration"],
  ];
  return (
    <div className="shell">
      <aside>
        <img src={logo} />
        <span className="admin-label">CAMPUS ADMINISTRATOR</span>
        <nav>
          {nav.map(([id, I, l]) => (
            <button
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              key={id}
            >
              <I />
              {l}
            </button>
          ))}
        </nav>
        <button className="signout" onClick={logout}>
          <LogOut />
          Sign out
        </button>
      </aside>
      <div className="work">
        <header>
          <div>
            <b>Mills Campus Vehicle Tracker</b>
            <span>
              {profile.display_name} • {profile.role.replaceAll("_", " ")}
            </span>
          </div>
          <button onClick={loadAll}>
            <RefreshCw />
            {busy ? "Loading…" : "Refresh"}
          </button>
        </header>
        <main>
          {tab === "dashboard" && (
            <>
              <Title
                title="Command centre"
                text="Live campus inventory, custody and movement activity."
              />
              <div className="cards">
                <Card n={data.vehicles.length} l="Known vehicles" />
                <Card n={active} l="On campus" good />
                <Card n={stale} l="Not seen in 7 days" warn />
                <Card
                  n={data.profiles.filter((x) => x.active).length}
                  l="Active users"
                />
              </div>
              <div className="grid2">
                <Panel title="Department custody">
                  <div className="bars">
                    {data.departments.map((d) => {
                      const n = data.vehicles.filter(
                        (v) => v.current_department_id === d.id,
                      ).length;
                      return (
                        <div key={d.id}>
                          <span>{d.name}</span>
                          <i>
                            <b
                              style={{
                                width: `${data.vehicles.length ? (n / data.vehicles.length) * 100 : 0}%`,
                                background: d.color,
                              }}
                            />
                          </i>
                          <strong>{n}</strong>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
                <Panel title="Latest movements">
                  <MovementRows rows={data.movements.slice(0, 10)} />
                </Panel>
              </div>
            </>
          )}
          {tab === "map" && (
            <>
              <Title
                title="Campus map"
                text="Search a vehicle and select it to centre its latest recorded pin."
              />
              <div className="map-layout">
                <div className="map-list">
                  <SearchBox value={query} set={setQuery} />
                  {vehicles
                    .filter((v) => v.current_latitude != null)
                    .map((v) => (
                      <button
                        className={selected === v.id ? "selected" : ""}
                        key={v.id}
                        onClick={() => setSelected(v.id)}
                      >
                        <i style={{ background: v.departments?.color }} />
                        <div>
                          <b>{v.stock_number || v.vin}</b>
                          <span>
                            {[v.year, v.make, v.model]
                              .filter(Boolean)
                              .join(" ")}
                          </span>
                          <small>
                            {v.dealerships?.name} • {v.departments?.name}
                          </small>
                        </div>
                      </button>
                    ))}
                </div>
                <FleetMap
                  vehicles={vehicles}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
            </>
          )}
          {tab === "vehicles" && (
            <>
              <Title
                title="Vehicle management"
                text="Search the live inventory, inspect photos and review complete custody history."
                actions={
                  <>
                    <button onClick={exportFleet}>
                      <Download />
                      Export CSV
                    </button>
                  </>
                }
              />
              <SearchBox value={query} set={setQuery} />
              <div className="panel table">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Stock / VIN</th>
                      <th>Vehicle</th>
                      <th>Current custody</th>
                      <th>Zone</th>
                      <th>Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr key={v.id} onClick={() => showVehicle(v)}>
                        <td>
                          <span className={"state " + v.state}>
                            {v.state.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td>
                          <b>{v.stock_number || "—"}</b>
                          <small>{v.vin}</small>
                        </td>
                        <td>
                          {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                        </td>
                        <td>
                          <i
                            className="dot"
                            style={{ background: v.departments?.color }}
                          />
                          {v.dealerships?.name}
                          <small>
                            {v.departments?.name} • {v.profiles?.display_name}
                          </small>
                        </td>
                        <td>{v.zones?.name || "GPS only"}</td>
                        <td>{new Date(v.last_seen_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === "movements" && (
            <>
              <Title
                title="Movement history"
                text="Append-only custody transfers created by employee scans."
              />
              <Panel>
                <MovementRows rows={data.movements} />
              </Panel>
            </>
          )}
          {tab === "users" && (
            <>
              <Title
                title="User management"
                text="Create accounts, assign access and issue temporary passwords."
                actions={
                  <button onClick={() => setModal("user")}>
                    <Plus />
                    Add user
                  </button>
                }
              />
              <div className="panel table">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Assignment</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.profiles.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <b>{p.display_name}</b>
                          <small>{p.username}</small>
                        </td>
                        <td>{p.role.replaceAll("_", " ")}</td>
                        <td>
                          {[
                            p.regions?.name,
                            p.campuses?.name,
                            p.dealerships?.name,
                            p.departments?.name,
                          ]
                            .filter(Boolean)
                            .join(" • ") || "Unassigned"}
                        </td>
                        <td>
                          <span
                            className={
                              "state " + (p.active ? "on_campus" : "removed")
                            }
                          >
                            {p.active ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="mini"
                            onClick={() =>
                              setModal({ type: "password", user: p })
                            }
                          >
                            <KeyRound />
                            Reset
                          </button>
                          <button
                            className="mini"
                            onClick={async () => {
                              await supabase
                                .from("profiles")
                                .update({ active: !p.active })
                                .eq("id", p.id);
                              loadAll();
                            }}
                          >
                            <UserX />
                            {p.active ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === "logins" && (
            <>
              <Title
                title="Login history"
                text="Who accessed the system, when, from which device and available location."
              />
              <LogTable rows={data.logins} />
            </>
          )}
          {tab === "audit" && (
            <>
              <Title
                title="Administrative audit log"
                text="Security-sensitive changes and management actions."
              />
              <div className="panel table">
                <table>
                  <thead>
                    <tr>
                      <th>Date and time</th>
                      <th>Administrator</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audits.map((a) => (
                      <tr key={a.id}>
                        <td>{new Date(a.created_at).toLocaleString()}</td>
                        <td>{a.profiles?.display_name || "—"}</td>
                        <td>{a.action.replaceAll("_", " ")}</td>
                        <td>{a.entity_type}</td>
                        <td>
                          <code>{a.entity_id}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === "settings" && (
            <>
              <Title
                title="Configuration"
                text="Regions, campuses, dealerships, departments and physical zones."
                actions={
                  <button onClick={() => setModal("zone")}>
                    <Plus />
                    Add zone
                  </button>
                }
              />
              <div className="cards">
                <Card n={data.regions.length} l="Regions" />
                <Card n={data.campuses.length} l="Campuses" />
                <Card n={data.dealers.length} l="Dealerships" />
                <Card n={data.zones.length} l="Defined zones" />
              </div>
              <div className="panel table">
                <table>
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Campus</th>
                      <th>Dealership</th>
                      <th>Coordinates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.zones.map((z) => (
                      <tr key={z.id}>
                        <td>
                          <b>{z.name}</b>
                        </td>
                        <td>{z.campuses?.name}</td>
                        <td>{z.dealerships?.name || "Shared campus zone"}</td>
                        <td>
                          {z.latitude != null
                            ? `${z.latitude}, ${z.longitude}`
                            : "Not set"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
        <footer>
          Powered by Blood, Sweat, and Tears and built by J. Langer
        </footer>
      </div>
      {detail && (
        <VehicleDrawer
          detail={detail}
          close={() => setDetail(null)}
          onEdit={() => setModal({ type: "vehicle", vehicle: detail.vehicle })}
        />
      )}{" "}
      {modal && (
        <Modal
          type={modal}
          data={data}
          close={() => setModal(null)}
          done={() => {
            setModal(null);
            setDetail(null);
            loadAll();
          }}
          setMsg={setMsg}
        />
      )}{" "}
      {msg && (
        <div
          className={"toast " + (msg.bad ? "bad" : "")}
          onClick={() => setMsg(null)}
        >
          {msg.bad ? <AlertTriangle /> : <CheckCircle2 />}
          {msg.text}
        </div>
      )}
    </div>
  );
}
function Login({ onSuccess, msg, setMsg }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  async function go(e) {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      await supabase.rpc("log_failed_login", {
        p_username: email,
        p_user_agent: navigator.userAgent,
      });
      setMsg({ bad: true, text: error.message });
    } else onSuccess(data.user);
  }
  return (
    <div className="login">
      <form onSubmit={go}>
        <img src={logo} />
        <h1>Administrator sign in</h1>
        <p>Protected Mills Auto Group system</p>
        <label>
          Work email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button>
          <ShieldCheck />
          Sign in securely
        </button>
        {msg && <div className="error">{msg.text}</div>}
      </form>
    </div>
  );
}
function ChangePassword({ onDone, setMsg }) {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    if (password.length < 10 || password !== confirm)
      return setMsg({
        bad: true,
        text: "Passwords must match and contain at least 10 characters.",
      });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) await supabase.rpc("complete_password_change");
    setBusy(false);
    if (error) setMsg({ bad: true, text: error.message });
    else onDone();
  }
  return (
    <div className="login">
      <form onSubmit={save}>
        <img src={logo} />
        <h1>Create a private password</h1>
        <p>Your administrator issued a temporary password.</p>
        <label>
          New password
          <input
            type="password"
            minLength="10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            minLength="10"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        <button disabled={busy}>
          <KeyRound />
          {busy ? "Updating…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
function Title({ title, text, actions }) {
  return (
    <div className="title">
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div>{actions}</div>
    </div>
  );
}
function Card({ n, l, good, warn }) {
  return (
    <div className={"card " + (good ? "good" : warn ? "warn" : "")}>
      <b>{n}</b>
      <span>{l}</span>
    </div>
  );
}
function Panel({ title, children }) {
  return (
    <div className="panel">
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}
function SearchBox({ value, set }) {
  return (
    <label className="search">
      <Search />
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder="Search VIN, stock, vehicle, dealership, department or zone…"
      />
    </label>
  );
}
function MovementRows({ rows }) {
  return (
    <div className="movement-rows">
      {rows.map((m) => (
        <div key={m.id}>
          <i style={{ background: m.departments?.color || "#777" }} />
          <div>
            <b>{m.vehicles?.stock_number || m.vehicles?.vin}</b>
            <span>
              {[m.vehicles?.make, m.vehicles?.model].filter(Boolean).join(" ")}
            </span>
          </div>
          <div>
            <b>{m.dealerships?.name}</b>
            <span>
              {m.departments?.name} • {m.profiles?.display_name}
            </span>
          </div>
          <time>{new Date(m.created_at).toLocaleString()}</time>
        </div>
      ))}
    </div>
  );
}
function LogTable({ rows }) {
  return (
    <div className="panel table">
      <table>
        <thead>
          <tr>
            <th>Date and time</th>
            <th>User</th>
            <th>Event</th>
            <th>Location</th>
            <th>Device</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id}>
              <td>{new Date(x.created_at).toLocaleString()}</td>
              <td>
                <b>
                  {x.profiles?.display_name ||
                    x.on_behalf_username ||
                    "Unknown"}
                </b>
                <small>{x.profiles?.username}</small>
              </td>
              <td>
                <span
                  className={
                    "state " +
                    (x.event === "success"
                      ? "on_campus"
                      : x.event === "failure"
                        ? "removed"
                        : "off_campus")
                  }
                >
                  {x.event}
                </span>
              </td>
              <td>
                {x.latitude != null
                  ? `${x.latitude.toFixed(5)}, ${x.longitude.toFixed(5)} ±${Math.round(x.accuracy_m || 0)}m`
                  : "IP / GPS unavailable"}
              </td>
              <td className="ua">{x.user_agent || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function VehicleDrawer({ detail, close, onEdit }) {
  const v = detail.vehicle;
  return (
    <div className="drawer">
      <header>
        <div>
          <b>{v.stock_number || v.vin}</b>
          <span>{[v.year, v.make, v.model].filter(Boolean).join(" ")}</span>
        </div>
        <button onClick={close}>
          <X />
        </button>
      </header>
      <div className="drawer-body">
        <button className="edit-vehicle" onClick={onEdit}>
          <Pencil /> Edit vehicle details
        </button>
        <p className="location-lock">
          Location, custody, campus zone and last-seen data are scan-only.
        </p>
        <h3>Vehicle details</h3>
        <div className="detail-grid">
          <span>
            <small>VIN</small>
            <b>{v.vin}</b>
          </span>
          <span>
            <small>Stock</small>
            <b>{v.stock_number || "—"}</b>
          </span>
          <span>
            <small>Trim</small>
            <b>{v.trim || "—"}</b>
          </span>
          <span>
            <small>Exterior / interior</small>
            <b>
              {[v.color, v.interior_color].filter(Boolean).join(" / ") || "—"}
            </b>
          </span>
        </div>
        <h3>Current location and custody</h3>
        <p>
          {v.dealerships?.name} • {v.departments?.name} •{" "}
          {v.zones?.name || "GPS only"}
        </p>
        <p>
          {v.profiles?.display_name} •{" "}
          {new Date(v.last_seen_at).toLocaleString()}
        </p>
        <h3>Location photographs</h3>
        <div className="photos">
          {detail.photos.map((p) => p.url && <img src={p.url} key={p.id} />)}
        </div>
        {!detail.photos.length && (
          <p className="muted">No photographs attached.</p>
        )}
        <h3>Custody timeline</h3>
        <div className="timeline">
          {detail.movements.map((m) => (
            <div key={m.id}>
              <i style={{ background: m.departments?.color }} />
              <b>
                {m.dealerships?.name} — {m.departments?.name}
              </b>
              <span>
                {m.zones?.name || "GPS location"} • {m.profiles?.display_name}
              </span>
              <small>{new Date(m.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Modal({ type, data, close, done, setMsg }) {
  const isPass = typeof type === "object" && type.type === "password";
  const isVehicle = typeof type === "object" && type.type === "vehicle";
  const vehicle = isVehicle ? type.vehicle : null;
  const [f, setF] = useState(
    isPass
      ? { password: "" }
      : isVehicle
        ? {
            vin: vehicle.vin || "",
            stock_number: vehicle.stock_number || "",
            year: vehicle.year || "",
            make: vehicle.make || "",
            model: vehicle.model || "",
            trim: vehicle.trim || "",
            color: vehicle.color || "",
            interior_color: vehicle.interior_color || "",
            license_plate: vehicle.license_plate || "",
            body_style: vehicle.body_style || "",
            engine: vehicle.engine || "",
            drivetrain: vehicle.drivetrain || "",
            transmission: vehicle.transmission || "",
            fuel_type: vehicle.fuel_type || "",
            packages: vehicle.packages || "",
            notes: vehicle.notes || "",
          }
        : {
            email: "",
            username: "",
            display_name: "",
            password: "",
            role: "employee",
            region_id: "",
            campus_id: "",
            dealership_id: "",
            department_id: "",
            name: "",
            latitude: "",
            longitude: "",
          },
  );
  async function submit(e) {
    e.preventDefault();
    try {
      if (isVehicle) {
        const { error } = await supabase.rpc("admin_edit_vehicle", {
          p_vehicle_id: vehicle.id,
          p_vin: norm(f.vin),
          p_stock_number: f.stock_number,
          p_year: f.year ? Number(f.year) : null,
          p_make: f.make,
          p_model: f.model,
          p_trim: f.trim,
          p_color: f.color,
          p_interior_color: f.interior_color,
          p_license_plate: f.license_plate,
          p_body_style: f.body_style,
          p_engine: f.engine,
          p_drivetrain: f.drivetrain,
          p_transmission: f.transmission,
          p_fuel_type: f.fuel_type,
          p_packages: f.packages,
          p_notes: f.notes,
        });
        if (error) throw error;
      } else if (type === "user" || isPass) {
        const body = isPass
          ? {
              action: "reset_password",
              user_id: type.user.id,
              password: f.password,
            }
          : { ...f, action: "create" };
        const { data: r, error } = await supabase.functions.invoke(
          "create-user",
          { body },
        );
        if (error) throw error;
        if (!r?.ok) throw Error(r?.error || "User action failed");
      } else {
        const { error } = await supabase.from("zones").insert({
          name: f.name,
          campus_id: f.campus_id,
          dealership_id: f.dealership_id || null,
          latitude: f.latitude ? Number(f.latitude) : null,
          longitude: f.longitude ? Number(f.longitude) : null,
        });
        if (error) throw error;
      }
      setMsg({
        text: isVehicle
          ? "Vehicle details updated. Location and custody were unchanged."
          : isPass
            ? "Temporary password issued."
            : type === "user"
              ? "User account created."
              : "Campus zone created.",
      });
      done();
    } catch (e) {
      setMsg({ bad: true, text: e.message });
    }
  }
  return (
    <div className="modal">
      <form onSubmit={submit}>
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <h2>
          {isVehicle
            ? `Edit ${vehicle.stock_number || vehicle.vin}`
            : isPass
              ? `Reset ${type.user.display_name}'s password`
              : type === "user"
                ? "Create employee account"
                : "Add campus zone"}
        </h2>
        {isVehicle ? (
          <>
            <div className="locked-location">
              <ShieldCheck />
              <div>
                <b>Location data is locked</b>
                <span>
                  GPS, zone, campus, dealership, department, custodian and
                  last-seen time can only change through a new mobile scan.
                </span>
              </div>
            </div>
            <div className="formgrid vehicle-edit-grid">
              <label>
                VIN
                <input
                  value={f.vin}
                  maxLength="17"
                  onChange={(e) => setF({ ...f, vin: norm(e.target.value) })}
                  required
                />
              </label>
              <label>
                Stock number
                <input
                  value={f.stock_number}
                  onChange={(e) =>
                    setF({ ...f, stock_number: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label>
                Year
                <input
                  type="number"
                  min="1886"
                  max="2200"
                  value={f.year}
                  onChange={(e) => setF({ ...f, year: e.target.value })}
                />
              </label>
              <label>
                Make
                <input
                  value={f.make}
                  onChange={(e) => setF({ ...f, make: e.target.value })}
                />
              </label>
              <label>
                Model
                <input
                  value={f.model}
                  onChange={(e) => setF({ ...f, model: e.target.value })}
                />
              </label>
              <label>
                Trim
                <input
                  value={f.trim}
                  onChange={(e) => setF({ ...f, trim: e.target.value })}
                />
              </label>
              <label>
                Exterior colour
                <input
                  value={f.color}
                  onChange={(e) => setF({ ...f, color: e.target.value })}
                />
              </label>
              <label>
                Interior colour
                <input
                  value={f.interior_color}
                  onChange={(e) =>
                    setF({ ...f, interior_color: e.target.value })
                  }
                />
              </label>
              <label>
                License plate
                <input
                  value={f.license_plate}
                  onChange={(e) =>
                    setF({ ...f, license_plate: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label>
                Body style
                <input
                  value={f.body_style}
                  onChange={(e) => setF({ ...f, body_style: e.target.value })}
                />
              </label>
              <label>
                Engine
                <input
                  value={f.engine}
                  onChange={(e) => setF({ ...f, engine: e.target.value })}
                />
              </label>
              <label>
                Drivetrain
                <input
                  value={f.drivetrain}
                  onChange={(e) => setF({ ...f, drivetrain: e.target.value })}
                />
              </label>
              <label>
                Transmission
                <input
                  value={f.transmission}
                  onChange={(e) => setF({ ...f, transmission: e.target.value })}
                />
              </label>
              <label>
                Fuel type
                <input
                  value={f.fuel_type}
                  onChange={(e) => setF({ ...f, fuel_type: e.target.value })}
                />
              </label>
              <label className="wide">
                Packages / options
                <textarea
                  value={f.packages}
                  onChange={(e) => setF({ ...f, packages: e.target.value })}
                />
              </label>
              <label className="wide">
                Vehicle notes
                <textarea
                  value={f.notes}
                  onChange={(e) => setF({ ...f, notes: e.target.value })}
                />
              </label>
            </div>
          </>
        ) : isPass ? (
          <label>
            New temporary password
            <input
              type="password"
              minLength="10"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              required
            />
          </label>
        ) : type === "user" ? (
          <>
            <div className="formgrid">
              <label>
                Display name
                <input
                  value={f.display_name}
                  onChange={(e) => setF({ ...f, display_name: e.target.value })}
                  required
                />
              </label>
              <label>
                Username
                <input
                  value={f.username}
                  onChange={(e) => setF({ ...f, username: e.target.value })}
                  required
                />
              </label>
              <label>
                Work email
                <input
                  type="email"
                  value={f.email}
                  onChange={(e) => setF({ ...f, email: e.target.value })}
                  required
                />
              </label>
              <label>
                Temporary password
                <input
                  type="password"
                  minLength="10"
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                  required
                />
              </label>
              <label>
                Role
                <select
                  value={f.role}
                  onChange={(e) => setF({ ...f, role: e.target.value })}
                >
                  {[
                    "employee",
                    "supervisor",
                    "dealership_admin",
                    "campus_admin",
                    "regional_admin",
                    "corporate_admin",
                    "system_admin",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <Select
                label="Region"
                list={data.regions}
                value={f.region_id}
                set={(v) => setF({ ...f, region_id: v })}
              />
              <Select
                label="Campus"
                list={data.campuses}
                value={f.campus_id}
                set={(v) => setF({ ...f, campus_id: v })}
              />
              <Select
                label="Dealership"
                list={data.dealers}
                value={f.dealership_id}
                set={(v) => setF({ ...f, dealership_id: v })}
              />
              <Select
                label="Department"
                list={data.departments}
                value={f.department_id}
                set={(v) => setF({ ...f, department_id: v })}
              />
            </div>
          </>
        ) : (
          <>
            <label>
              Zone name
              <input
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                required
              />
            </label>
            <Select
              label="Campus"
              list={data.campuses}
              value={f.campus_id}
              set={(v) => setF({ ...f, campus_id: v })}
            />
            <Select
              label="Dealership (optional)"
              list={data.dealers}
              value={f.dealership_id}
              set={(v) => setF({ ...f, dealership_id: v })}
            />
            <div className="formgrid">
              <label>
                Latitude
                <input
                  value={f.latitude}
                  onChange={(e) => setF({ ...f, latitude: e.target.value })}
                />
              </label>
              <label>
                Longitude
                <input
                  value={f.longitude}
                  onChange={(e) => setF({ ...f, longitude: e.target.value })}
                />
              </label>
            </div>
          </>
        )}
        <button className="submit">
          {isVehicle
            ? "Save vehicle details"
            : isPass
              ? "Reset password"
              : type === "user"
                ? "Create user"
                : "Create zone"}
        </button>
      </form>
    </div>
  );
}
function Select({ label, list, value, set }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">None / select</option>
        {list.map((x) => (
          <option value={x.id} key={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </label>
  );
}
createRoot(document.getElementById("root")).render(<App />);
