const STORAGE_KEY = "vcare-vanilla-data-v1"
const SESSION_KEY = "vcare-vanilla-session"
let isRegisterMode = false // Status untuk beralih antara form Login dan Register

const userMenu = [
  ["Dashboard", "DB"],
  ["Jenis Servis", "JS"],
  ["Riwayat Servis", "RS"],
  ["Rekap Biaya", "RB"],
]

const adminMenu = [
  ["Ringkasan Admin", "RA"],
  ["Data Pengguna", "DP"],
  ["Pengingat Servis", "PS"],
  ["Servis Pengguna", "SP"],
  ["Pesan Bantuan", "PB"],
]

let state = null
let currentUserId = Number(localStorage.getItem(SESSION_KEY)) || null
let currentPage = "Dashboard"
let searchTerm = ""
let mobileMenuOpen = false

const app = document.querySelector("#app")
const toast = document.querySelector("#toast")

boot()

async function fetchAppDataForUser(user) {
  try {
    if (user.role === "admin") {
      const resAll = await fetch(`http://localhost:3000/api/admin/all-data`)
      if (resAll.ok) {
        const allData = await resAll.json()
        state.users = allData.users
        state.vehicles = allData.vehicles
        state.services = allData.services
      }
    } else {
      state.users = [user]
      const userId = user.id_user || user.id
      const resVehicles = await fetch(`http://localhost:3000/api/vehicles/${userId}`)
      if (resVehicles.ok) state.vehicles = await resVehicles.json()

      const resServices = await fetch(`http://localhost:3000/api/services/${userId}`)
      if (resServices.ok) state.services = await resServices.json()
    }
  } catch (dbErr) {
    console.log("Gagal menyinkronkan dengan database:", dbErr)
  }
}

async function boot() {
  try {
    state = {
      users: [],
      vehicles: [],
      services: [],
      serviceTypes: [
        { id: 1, name: "Servis Berkala" },
        { id: 2, name: "Ganti Oli" },
        { id: 3, name: "Ganti Ban" },
        { id: 4, name: "Rem & Kampas" }
      ],
      tickets: [],
      settings: { reminder: true, reminderDays: 7, theme: "light" }
    }

    if (currentUserId) {
      try {
        const resLoginUser = await fetch(`http://localhost:3000/api/login-user/${currentUserId}`)
        if (resLoginUser.ok) {
          const loggedInUser = await resLoginUser.json()
          await fetchAppDataForUser(loggedInUser)
        }
      } catch (dbErr) {
        console.log("Gagal memuat sesi:", dbErr)
      }
    }

    state.tickets ||= []
    if (currentUser()?.role === "admin") currentPage = "Ringkasan Admin"
    applyTheme()
    render()
  } catch (error) {
    app.innerHTML = `
      <div class="loading-screen">
        <div class="brand-mark">!</div>
        <strong>VCare gagal dimuat</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>`
  }
}

function render() {
  const user = currentUser()
  if (!user) {
    document.body.classList.remove("dark")
    renderLogin()
    return
  }
  renderShell(user)
  renderPage()
}

function renderLogin() {
  app.innerHTML = `
    <main class="login">
      <section class="login-intro">
       <div class="login-brand">
        <img src="Vcare.png" alt="Logo VCare" class="brand-logo-img">
        <div><strong>VCare</strong><br><small>Vehicle care, made simple</small></div>
       </div>
        <div class="login-copy">
          <p class="eyebrow">Kendaraan terawat, perjalanan tenang</p>
          <h1>Semua riwayat kendaraan Anda dalam satu tempat.</h1>
          <p>Catat servis, pantau biaya, dan kelola jadwal perawatan dengan lebih rapi melalui VCare.</p>
        </div>
      </section>
      <section class="login-panel">
        <div class="login-card">
          <h2>${isRegisterMode ? "Buat akun baru" : "Masuk ke akun"}</h2>
          <p>${isRegisterMode ? "Selamat datang, Jangan lupa Daftar dulu!." : "Sudah punya akun? yuk login."}</p>
          
          <form id="authForm">
            ${isRegisterMode ? `
              <label class="field">Nama Lengkap
                <input id="registerName" type="text" placeholder="Nama Anda" required>
              </label>
              <label class="field">Nomor Telepon
                <input id="registerPhone" type="text" placeholder="08xxxxxxxxxx">
              </label>
            ` : ""}
            <label class="field">Email
              <input id="loginEmail" type="email" placeholder="${isRegisterMode ? "email@gmail.com" : "email@gmail.com"}" required>
            </label>
            <label class="field">Kata sandi
              <input id="loginPassword" type="password" placeholder="${isRegisterMode ? "••••••••" : "••••••••"}" required>
            </label>
            <p id="loginError" class="muted" style="color:var(--danger)"></p>
            <button class="primary-btn full-btn" type="submit">${isRegisterMode ? "Daftar Sekarang" : "Masuk"}</button>
          </form>

          <div style="margin-top: 16px; text-align: center;">
            <button id="toggleModeBtn" class="secondary-btn full-btn" type="button" style="background:transparent; border:none; color:var(--primary); cursor:pointer;">
              ${isRegisterMode ? "Sudah punya akun? Masuk di sini" : "Belum punya akun? Daftar di sini"}
            </button>
          </div>

          
        </div>
      </section>
    </main>`

  document.querySelector("#authForm").addEventListener("submit", isRegisterMode ? handleRegister : login)

  document.querySelector("#toggleModeBtn").addEventListener("click", () => {
    isRegisterMode = !isRegisterMode
    renderLogin()
  })
}

async function login(event) {
  event.preventDefault()
  const email = document.querySelector("#loginEmail").value.trim().toLowerCase()
  const password = document.querySelector("#loginPassword").value

  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Email atau kata sandi tidak sesuai.")
    }

    const user = result.user

    currentUserId = user.id_user || user.id
    currentPage = user.role === "admin" ? "Ringkasan Admin" : "Kendaraan"
    localStorage.setItem(SESSION_KEY, String(currentUserId))
    
    // Tarik data database otomatis sesuai role sebelum merender tampilan
    await fetchAppDataForUser(user)

    showToast("Login berhasil!")
    render()

  } catch (error) {
    document.querySelector("#loginError").textContent = error.message
  }
}

async function handleRegister(event) {
  event.preventDefault()
  const name = document.querySelector("#registerName").value.trim()
  const phone = document.querySelector("#registerPhone").value.trim()
  const email = document.querySelector("#loginEmail").value.trim().toLowerCase()
  const password = document.querySelector("#loginPassword").value

  try {
    const response = await fetch('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Gagal mendaftarkan akun.")
    }

    // Buat objek user baru secara lokal agar langsung bisa dikenali sesi login
    const newUser = {
      id_user: result.userId || Date.now(), // Sesuaikan dengan id_user
  name: name,
  email: email,
  password: password,
  phone: phone,
  role: "user"
    }

    // Masukkan ke state.users agar langsung bisa diakses
    state.users.push(newUser)

    // Langsung set sesi login aktif tanpa perlu login ulang
    currentUserId = newUser.id_user
    currentPage = "Kendaraan"
    localStorage.setItem(SESSION_KEY, String(currentUserId))
    
    showToast("Registrasi berhasil! Selamat datang.")
    render() // Langsung masuk ke dalam dashboard/website!

  } catch (error) {
    document.querySelector("#loginError").textContent = error.message
  }
}

function renderShell(user) {
  const overdue = overdueUserServices()
  const reminders = ownServices().filter(
    (service) => service.status === "Terjadwal" && service.reminderSentAt,
  )
  const notificationCount =
    user.role === "admin" ? overdue.length : reminders.length
  const desktopMain = user.role === "admin" ? adminMenu : userMenu
  const desktopOperational = user.role === "admin" ? userMenu : []

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <button class="brand ghost-btn" data-page="${
          user.role === "admin" ? "Ringkasan Admin" : "Kendaraan"
        }">
          <img src="Vcare.png" alt="Logo VCare" class="brand-logo-img">
          <span><strong>VCare</strong><small>${
            user.role === "admin" ? "Panel administrator" : "Catatan kendaraan"
          }</small></span>
        </button>
        <p class="nav-title">Menu utama</p>
        <nav class="nav-list">${navButtons(desktopMain)}</nav>
        ${
          desktopOperational.length
            ? `<p class="nav-title spaced">Operasional admin</p><nav class="nav-list">${navButtons(desktopOperational)}</nav>`
            : ""
        }
        <div class="sidebar-bottom">
          ${user.role === "user" ? navButton(["Bantuan", "BT"]) : ""}
          ${navButton(["Pengaturan", "PG"])}
          <button class="nav-button" data-action="logout"><span class="nav-icon">KL</span>Keluar</button>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <span class="date-label">${todayLabel()}</span>
            <h1 id="pageTitle">${pageTitle(user)}</h1>
          </div>
          <div class="top-actions">
            <button class="circle-button" data-action="notifications" aria-label="Notifikasi">
              N
              ${
                notificationCount
                  ? `<span class="badge">${
                      notificationCount > 9 ? "9+" : notificationCount
                    }</span>`
                  : ""
              }
            </button>
            <button class="profile-button" data-page="Pengaturan">
              ${avatarHtml(user)}
              <span>${escapeHtml(user.name.split(" ")[0])}</span>
            </button>
          </div>
        </header>
        <div id="pageContent"></div>
      </main>

      ${mobileNav(user)}
      <div id="modalRoot"></div>
    </div>`

  bindShellEvents()
}

function navButtons(items) {
  return items.map(navButton).join("")
}

function navButton([label, icon]) {
  return `<button class="nav-button ${
    currentPage === label ? "active" : ""
  }" data-page="${label}">
    <span class="nav-icon">${icon}</span>${label}
  </button>`
}

function mobileNav(user) {
  const menuItems =
    user.role === "admin"
      ? [...adminMenu, ...userMenu.filter(([label]) => label !== "Kendaraan")]
      : [
          ...userMenu.filter(([label]) => label !== "Kendaraan"),
          ["Bantuan", "BT"],
        ]
  return `
    ${
      mobileMenuOpen
        ? `<button class="mobile-overlay" data-action="close-mobile" aria-label="Tutup menu"></button>
      <div class="mobile-menu">
        <div class="section-head"><div><p class="eyebrow">MENU VCARE</p><strong>${
          user.role === "admin"
            ? "Administrasi & operasional"
            : "Layanan kendaraan"
        }</strong></div><button class="icon-button" data-action="close-mobile">X</button></div>
        <div class="mobile-menu-grid">
          ${menuItems.map(([label]) => `<button class="${currentPage === label ? "active" : ""}" data-page="${label}">${label}</button>`).join("")}
          <button class="danger-btn" data-action="logout">Keluar</button>
        </div>
      </div>`
        : ""
    }
    <nav class="mobile-nav">
      <button class="${
        currentPage === "Dashboard" ? "active" : ""
      }" data-page="Dashboard">Dashboard</button>
      <button class="${
        currentPage !== "Dashboard" ? "active" : ""
      }" data-action="toggle-mobile">Menu</button>
    </nav>`
}

function bindShellEvents() {
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      currentPage = button.dataset.page
      searchTerm = ""
      mobileMenuOpen = false
      render()
    })
  })
  document.querySelectorAll('[data-action="logout"]').forEach((button) => {
    button.addEventListener("click", logout)
  })
  document.querySelectorAll('[data-action="toggle-mobile"]').forEach((button) =>
    button.addEventListener("click", () => {
      mobileMenuOpen = !mobileMenuOpen
      render()
    }),
  )
  document.querySelectorAll('[data-action="close-mobile"]').forEach((button) =>
    button.addEventListener("click", () => {
      mobileMenuOpen = false
      render()
    }),
  )
  document
    .querySelector('[data-action="notifications"]')
    .addEventListener("click", () => {
      currentPage =
        currentUser().role === "admin" ? "Pengingat Servis" : "Jenis Servis"
      render()
    })
}

function renderPage() {
  const content = document.querySelector("#pageContent")
  const pages = {
    Kendaraan: renderVehicles,
    "Jenis Servis": renderSchedule,
    "Riwayat Servis": renderHistory,
    "Rekap Biaya": renderRecap,
    Bantuan: renderHelp,
    Pengaturan: renderSettings,
    "Ringkasan Admin": renderAdminOverview,
    "Data Pengguna": renderAdminUsers,
    "Pengingat Servis": renderAdminReminders,
    "Servis Pengguna": renderAdminServices,
    "Pesan Bantuan": renderAdminTickets,
  }
  content.innerHTML = (pages[currentPage] || renderVehicles)()
  bindPageEvents()
}

function toolbar(actionLabel, action) {
  return `<div class="toolbar">
    <label class="search-box">C
      <input id="searchInput" value="${escapeAttr(searchTerm)}" placeholder="Cari kendaraan, bengkel, atau jenis servis...">
    </label>
    <button class="primary-btn" data-action="${action}">+ ${actionLabel}</button>
  </div>`
}

function renderVehicles() {
  const vehicles = ownVehicles().filter((vehicle) =>
    `${vehicle.name} ${vehicle.plate}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  )
  const completed = ownServices().filter(
    (service) => service.status === "Selesai",
  )
  const scheduled = ownServices()
    .filter((service) => service.status === "Terjadwal")
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  return `
    ${toolbar("Tambah kendaraan", "add-vehicle")}
    ${userReminderBanner()}
    <section class="stats-grid">
      ${stat("KR", "Total kendaraan", vehicles.length, "Aktif tercatat")}
      ${stat("JS", "Servis berikutnya", scheduled ? formatDate(scheduled.date) : "Belum ada", scheduled ? serviceType(scheduled.serviceTypeId)?.name : "Buat jadwal baru")}
      ${stat("RB", "Total pengeluaran", rupiah(sum(completed, "cost")), "Seluruh riwayat")}
    </section>
    <div class="section-head"><div><p class="eyebrow">GARASI SAYA</p><h2>Kendaraan & servis terakhir</h2></div></div>
    <section class="card-grid">
      ${vehicles.map(vehicleCard).join("") || empty("Belum ada kendaraan. Tambahkan kendaraan pertama Anda.")}
    </section>`
}

function vehicleCard(vehicle) {
  const vId = vehicle.vehicle_id || vehicle.id;
  const latest = state.services
    .filter(
      (service) =>
        (service.vehicleId || service.vehicle_id) === vId && service.status === "Selesai",
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  return `<article class="vehicle-card">
    <div class="vehicle-head">
      <div class="vehicle-info">
        <span class="vehicle-icon" style="background:${escapeAttr(vehicle.color || '#3d7165')}">KR</span>
        <div><h3>${escapeHtml(vehicle.name)}</h3><p>${escapeHtml(vehicle.plate)} · ${vehicle.year}</p></div>
      </div>
      <div class="actions">
        <button class="icon-button" data-action="edit-vehicle" data-id="${vId}" aria-label="Edit">E</button>
        <button class="icon-button danger" data-action="delete-vehicle" data-id="${vId}" aria-label="Hapus">H</button>
      </div>
    </div>
    <div class="vehicle-meta">
      <div class="meta-box"><span>Odometer</span><strong>${number(vehicle.odometer)} km</strong></div>
      <div class="meta-box"><span>Servis terakhir</span><strong>${
        latest ? formatDate(latest.date) : "Belum ada"
      }</strong></div>
    </div>
    <div class="row-between" style="margin-top:16px">
      <small class="muted">${
        latest
          ? `${escapeHtml(serviceType(latest.serviceTypeId || latest.service_type_id)?.name || "-")} · ${rupiah(latest.cost)}`
          : "Belum ada riwayat"
      }</small>
      <button class="secondary-btn" data-action="add-service" data-vehicle="${vId}">+ Catat servis</button>
    </div>
  </article>`
}

function renderSchedule() {
  const services = ownServices()
    .filter((service) => service.status === "Terjadwal")
    .sort((a, b) => a.date.localeCompare(b.date))
  return `
    ${toolbar("Jadwalkan servis", "add-service")}
    ${userReminderBanner()}
    <section class="two-column">
      <div class="calendar-panel">
        <p class="eyebrow" style="color:#afcdc1">JADWAL SERVIS</p>
        <h2>Jangan lewatkan perawatan</h2>
        ${services.map(scheduleCard).join("") || `<div class="empty" style="color:#bdd2ca">Belum ada servis terjadwal.</div>`}
      </div>
      <article class="panel">
        <div class="stat-icon">TP</div>
        <h3>Tips perawatan</h3>
        <p class="muted">Cek tekanan ban setiap dua minggu dan pastikan level oli sesuai batas aman sebelum perjalanan jauh.</p>
        <div class="meta-box"><span>Verifikasi</span><strong>Setelah servis selesai, tekan “Verifikasi sudah servis” agar data masuk ke riwayat.</strong></div>
      </article>
    </section>`
}

function scheduleCard(service) {
  const vehicle = vehicleById(service.vehicleId)
  const type = serviceType(service.serviceTypeId)
  const overdue = service.date < todayIso()
  const date = new Date(`${service.date}T00:00:00`)
  return `<article class="schedule-card ${overdue ? "overdue" : ""}">
    <div class="schedule-main">
      <div class="date-box"><span><strong>${date.getDate()}</strong>${date.toLocaleDateString("id-ID", { month: "short" })}</span></div>
      <div><strong>${escapeHtml(type?.name || "-")}</strong><br><small>${escapeHtml(vehicle?.name || "-")} · ${escapeHtml(service.workshop)}</small>
      ${
        service.reminderMessage
          ? `<br><small><strong>Admin:</strong> ${escapeHtml(service.reminderMessage)}</small>`
          : ""
      }</div>
    </div>
    <div class="schedule-actions">
      <button data-action="edit-service" data-id="${service.id}">Edit jadwal</button>
      <button class="verify-btn" data-action="verify-service" data-id="${service.id}">Verifikasi sudah servis</button>
    </div>
  </article>`
}

function renderHistory() {
  const services = ownServices()
    .filter((service) => service.status === "Selesai")
    .filter(serviceMatchesSearch)
    .sort((a, b) => b.date.localeCompare(a.date))
  return `
    ${toolbar("Catat servis", "add-service")}
    <div class="section-head"><div><p class="eyebrow">ARSIP SERVIS</p><h2>Riwayat perawatan selesai</h2></div><small class="muted">${services.length} catatan</small></div>
    <div class="panel no-pad table-wrap">
      <table><thead><tr><th>Kendaraan</th><th>Perawatan</th><th>Tanggal/KM</th><th>Bengkel</th><th>Biaya</th><th>Aksi</th></tr></thead>
      <tbody>${services.map(serviceRow).join("") || `<tr><td colspan="6">${empty("Tidak ada riwayat ditemukan.")}</td></tr>`}</tbody></table>
    </div>`
}

function serviceRow(service) {
  const vehicle = vehicleById(service.vehicleId)
  const type = serviceType(service.serviceTypeId)
  return `<tr>
    <td><strong>${escapeHtml(vehicle?.name || "-")}</strong><br><small class="muted">${escapeHtml(vehicle?.plate || "")}</small></td>
    <td><strong>${escapeHtml(type?.name || "-")}</strong><br><small class="muted">${escapeHtml(service.notes || "Tanpa catatan")}</small></td>
    <td>${formatDate(service.date)}<br><small class="muted">${number(service.odometer)} km</small></td>
    <td>${escapeHtml(service.workshop)}</td><td><strong>${rupiah(service.cost)}</strong></td>
    <td><button class="icon-button" data-action="edit-service" data-id="${service.id}">E</button><button class="icon-button danger" data-action="delete-service" data-id="${service.id}">H</button></td>
  </tr>`
}

function renderRecap() {
  const services = ownServices().filter(
    (service) => service.status === "Selesai",
  )
  const total = sum(services, "cost")
  const groups = ownVehicles()
    .map((vehicle) => {
      const records = services.filter(
        (service) => service.vehicleId === vehicle.id,
      )
      return { vehicle, total: sum(records, "cost"), count: records.length }
    })
    .filter((item) => item.count)
  const max = Math.max(...groups.map((item) => item.total), 1)
  return `
    <section class="stats-grid">
      ${stat("RB", "Total biaya", rupiah(total), "Semua kendaraan")}
      ${stat("TR", "Jumlah transaksi", services.length, "Servis selesai")}
      ${stat("RT", "Rata-rata biaya", rupiah(services.length ? total / services.length : 0), "Per kunjungan")}
    </section>
    <article class="panel"><p class="eyebrow">PER KENDARAAN</p><h2>Distribusi biaya servis</h2>
      <div style="margin-top:26px">${
        groups
          .map(
            (item) => `
        <div class="recap-row">
          <div class="row-between"><div><strong>${escapeHtml(item.vehicle.name)}</strong><br><small class="muted">${item.count} transaksi</small></div><strong>${rupiah(item.total)}</strong></div>
          <div class="progress" style="margin-top:10px"><span style="width:${(item.total / max) * 100}%"></span></div>
        </div>`,
          )
          .join("") || empty("Belum ada biaya servis.")
      }</div>
    </article>`
}

function renderHelp() {
  const tickets = state.tickets.filter(
    (ticket) => ticket.userId === currentUserId,
  )
  return `<section class="two-column">
    <article class="panel">
      <p class="eyebrow">PUSAT BANTUAN</p><h2>Apa yang bisa kami bantu?</h2>
      <p class="muted">Isi formulir berikut. Pesan akan muncul pada dashboard admin.</p>
      <form id="helpForm" style="margin-top:22px">
        <label class="field">Kategori<select name="category"><option>Kendala teknis</option><option>Data kendaraan</option><option>Akun & profil</option><option>Lainnya</option></select></label>
        <label class="field">Subjek<input name="subject" required></label>
        <label class="field">Detail kendala<textarea name="message" required></textarea></label>
        <button class="primary-btn" type="submit">Kirim ke admin</button>
      </form>
    </article>
    <article class="panel"><p class="eyebrow">TIKET SAYA</p><h2>Permintaan terbaru</h2>
      <div style="margin-top:18px">${tickets.map(ticketCardUser).join("") || empty("Belum ada permintaan bantuan.")}</div>
    </article>
  </section>`
}

function ticketCardUser(ticket) {
  return `<div class="ticket-card">
    <div class="ticket-head"><strong>${escapeHtml(ticket.subject)}</strong><span class="status warning">${ticket.status}</span></div>
    <small class="muted">${escapeHtml(ticket.category)} · ${formatDateTime(ticket.createdAt)}</small>
    ${
      ticket.reply
        ? `<div class="admin-reply"><strong>Balasan admin</strong><br>${escapeHtml(ticket.reply)}</div>`
        : ""
    }
  </div>`
}

function renderSettings() {
  const user = currentUser()
  const settings = state.settings
  return `<section class="two-column">
    <article class="panel">
      <p class="eyebrow">PREFERENSI</p><h2>Profil & tampilan</h2>
      <form id="profileForm" style="margin-top:22px">
        <div class="profile-upload">
          <div id="photoPreview" class="profile-photo">${
            user.avatar
              ? `<img src="${escapeAttr(user.avatar)}" alt="Foto profil">`
              : initials(user.name)
          }</div>
          <div><strong>Foto profil</strong><br><small class="muted">JPG atau PNG, maksimal 2 MB.</small><br><label class="secondary-btn" style="margin-top:9px">Ganti foto<input id="photoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden></label></div>
        </div>
        <input id="photoData" type="hidden" value="${escapeAttr(user.avatar || "")}">
        <label class="field">Nama pengguna<input name="name" value="${escapeAttr(user.name)}" required></label>
        <div class="form-grid">
          <label class="field">Email<input name="email" type="email" value="${escapeAttr(user.email)}" required></label>
          <label class="field">Nomor telepon<input name="phone" value="${escapeAttr(user.phone)}" required></label>
        </div>
        <p><strong>Tema website</strong></p>
        <div class="theme-options">
          <button type="button" class="theme-option ${
            settings.theme === "light" ? "active" : ""
          }" data-theme="light">Terang</button>
          <button type="button" class="theme-option ${
            settings.theme === "dark" ? "active" : ""
          }" data-theme="dark">Gelap</button>
        </div>
        <label class="field">Ingatkan sebelum (hari)<input name="reminderDays" type="number" min="1" max="90" value="${settings.reminderDays}"></label>
        <button class="primary-btn" type="submit">Simpan profil & pengaturan</button>
      </form>
    </article>
    <div>
      <article class="panel"><h3>Data & cadangan</h3><p class="muted">Unduh seluruh data VCare dalam format JSON.</p><button class="secondary-btn full-btn" data-action="export">Unduh cadangan</button></article>
      <article class="panel" style="margin-top:16px"><h3 style="color:var(--danger)">Reset data</h3><p class="muted">Pulihkan seluruh data ke contoh awal.</p><button class="danger-btn" data-action="reset">Pulihkan data contoh</button></article>
    </div>
  </section>`
}

function renderAdminOverview() {
  const users = state.users.filter((user) => user.role === "user")
  return `<section>
    <div class="admin-hero"><p class="eyebrow" style="color:#a9c9bd">VCARE ADMINISTRATION</p><h2>Ringkasan aktivitas aplikasi</h2><p>Pantau pengguna, kendaraan, servis, dan permintaan bantuan.</p></div>
    <div class="stats-grid four">
      ${stat("PG", "Total pengguna", users.length, "Akun pengguna")}
      ${stat("KR", "Data kendaraan", state.vehicles.length, "Ditambahkan pengguna")}
      ${stat("SV", "Catatan servis", state.services.length, "Seluruh status")}
      ${stat("TK", "Tiket terbuka", state.tickets.filter((ticket) => ticket.status !== "Selesai").length, "Perlu ditindaklanjuti")}
    </div>
    <section class="two-column">
      <article class="panel"><p class="eyebrow">PENGGUNA</p>${users.map((user) => `<div class="user-row ticket-card"><div><strong>${escapeHtml(user.name)}</strong><br><small class="muted">${escapeHtml(user.email)}</small></div><strong>${state.vehicles.filter((vehicle) => vehicle.owner_id === user.id_user).length} kendaraan</strong></div>`).join("")}</article>
      <article class="panel"><p class="eyebrow">TIKET TERBARU</p>${state.tickets.slice(0, 4).map(ticketCardUser).join("") || empty("Belum ada tiket masuk.")}</article>
    </section>
  </section>`
}

function renderAdminUsers() {
  const users = state.users.filter((user) => user.role === "user")
  return `<div><div class="section-head"><div><p class="eyebrow">AKTIVITAS PENGGUNA</p><h2>Kendaraan yang ditambahkan pengguna</h2></div></div>
    ${users
      .map((user) => {
        const userId = user.id_user || user.id
        const vehicles = state.vehicles.filter(
          (vehicle) => (vehicle.owner_id || vehicle.ownerId) === userId
        )
        return `<article class="user-block">
        <div class="user-row"><div>${avatarHtml(user)}<strong>${escapeHtml(user.name)}</strong><br><small class="muted">${escapeHtml(user.email)} ·${escapeHtml(user.phone)}</small></div><span class="status">${vehicles.length} kendaraan</span></div>
        <div class="card-grid" style="margin-top:16px">${vehicles.map(vehicleCardAdmin).join("") || empty("Pengguna belum menambahkan kendaraan.")}</div>
      </article>`
      })
      .join("")}</div>`
}

function vehicleCardAdmin(vehicle) {
  const vId = vehicle.vehicle_id || vehicle.id;
  const records = state.services.filter(
    (service) => (service.vehicleId || service.vehicle_id) === vId,
  )
  return `<div class="type-card">
    <div class="vehicle-info">
      <span class="vehicle-icon" style="background:${escapeAttr(vehicle.color || '#3d7165')}">KR</span>
      <div><strong>${escapeHtml(vehicle.name)}</strong><br><small class="muted">${escapeHtml(vehicle.plate)} · ${vehicle.year}</small></div>
    </div>
    <div class="row-between" style="margin-top:15px">
      <small>${number(vehicle.odometer)} km</small>
      <strong>${records.length} riwayat</strong>
    </div>
  </div>`
}

function renderAdminReminders() {
  const services = overdueUserServices()
  return `<div><div class="section-head"><div><p class="eyebrow">SERVIS TERLAMBAT</p><h2>Jadwal yang perlu diingatkan</h2></div></div>
    ${
      services
        .map((service) => {
          const vehicle = vehicleById(service.vehicleId || service.vehicle_id)
          const owner = state.users.find((user) => (user.id_user || user.id) === (vehicle?.owner_id || vehicle?.ownerId))
          return `<article class="reminder-card">
        <div class="ticket-head"><div><strong>${escapeHtml(serviceType(service.serviceTypeId || service.service_type_id)?.name || "-")}</strong><br><small class="muted">${escapeHtml(owner?.name || "-")} · ${escapeHtml(vehicle?.name || "-")} · terlambat sejak ${formatDate(service.date)}</small></div><span class="status warning">Terlambat</span></div>
        <form class="reply-form reminder-form" data-id="${service.id}"><input name="message" required value="${escapeAttr(service.reminderMessage || "Apakah servis kendaraan ini sudah dilakukan?")}"><button class="primary-btn">Kirim pengingat</button></form>
        </article>`
        })
        .join("") || empty("Tidak ada servis pengguna yang terlambat.")
    }</div>`
}

function renderAdminServices() {
  const records = state.services
    .filter((service) => vehicleOwner(service.vehicleId)?.role === "user")
    .sort((a, b) => b.date.localeCompare(a.date))
  return `<div><div class="section-head"><div><p class="eyebrow">AKTIVITAS SERVIS</p><h2>Jadwal dan riwayat servis pengguna</h2></div></div>
    <div class="panel no-pad table-wrap"><table><thead><tr><th>Pengguna</th><th>Kendaraan</th><th>Jenis servis</th><th>Tanggal</th><th>Biaya</th><th>Status</th></tr></thead>
    <tbody>${records
      .map((service) => {
        const vehicle = vehicleById(service.vehicleId)
        const owner = vehicleOwner(service.vehicleId)
        const overdue =
          service.status === "Terjadwal" && service.date < todayIso()
        return `<tr><td><strong>${escapeHtml(owner?.name || "-")}</strong><br><small class="muted">${escapeHtml(owner?.email || "")}</small></td><td>${escapeHtml(vehicle?.name || "-")}<br><small class="muted">${escapeHtml(vehicle?.plate || "")}</small></td><td>${escapeHtml(serviceType(service.serviceTypeId)?.name || "-")}<br><small class="muted">${escapeHtml(service.workshop)}</small></td><td>${formatDate(service.date)}</td><td>${rupiah(service.cost)}</td><td><span class="status ${
          service.status === "Terjadwal" ? "warning" : ""
        }">${overdue ? "Terlambat" : service.status}</span></td></tr>`
      })
      .join("")}</tbody></table></div></div>`
}

function renderAdminTickets() {
  return `<div><div class="section-head"><div><p class="eyebrow">PUSAT DUKUNGAN</p><h2>Pesan bantuan pengguna</h2></div></div>
    ${
      state.tickets
        .map((ticket) => {
          const user = state.users.find((item) => item.id === ticket.userId)
          return `<article class="ticket-card">
        <div class="ticket-head"><div><strong>${escapeHtml(ticket.subject)}</strong><br><small class="muted">${escapeHtml(user?.name || "-")} · ${escapeHtml(user?.email || "")} · ${escapeHtml(ticket.category)}</small></div>
        <select class="ticket-status" data-id="${ticket.id}"><option ${
          ticket.status === "Baru" ? "selected" : ""
        }>Baru</option><option ${
          ticket.status === "Diproses" ? "selected" : ""
        }>Diproses</option><option ${
          ticket.status === "Selesai" ? "selected" : ""
        }>Selesai</option></select></div>
        <div class="ticket-message">${escapeHtml(ticket.message)}</div>
        ${
          ticket.reply
            ? `<div class="admin-reply"><strong>Balasan admin</strong><br>${escapeHtml(ticket.reply)}</div>`
            : ""
        }
        <form class="reply-form ticket-reply-form" data-id="${ticket.id}"><input name="reply" value="${escapeAttr(ticket.reply || "")}" placeholder="Tulis balasan..." required><button class="primary-btn">Kirim balasan</button></form>
      </article>`
        })
        .join("") || empty("Belum ada pesan bantuan.")
    }</div>`
}

function bindPageEvents() {
  document.querySelectorAll("#pageContent [data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      currentPage = button.dataset.page
      render()
    })
  })
  const search = document.querySelector("#searchInput")
  if (search) {
    search.addEventListener("input", (event) => {
      searchTerm = event.target.value
      renderPage()
      const next = document.querySelector("#searchInput")
      next?.focus()
      next?.setSelectionRange(searchTerm.length, searchTerm.length)
    })
  }
  bindClick("add-vehicle", () => openVehicleModal())
  bindClick("add-service", (button) =>
    openServiceModal(null, Number(button.dataset.vehicle) || null),
  )
  bindClick("edit-vehicle", (button) =>
    openVehicleModal(vehicleById(Number(button.dataset.id))),
  )
  bindClick("delete-vehicle", deleteVehicle)
  bindClick("edit-service", (button) =>
    openServiceModal(serviceById(Number(button.dataset.id))),
  )
  bindClick("delete-service", deleteService)
  bindClick("verify-service", verifyService)
  bindClick("export", exportData)
  bindClick("reset", resetData)

  document.querySelector("#helpForm")?.addEventListener("submit", submitHelp)
  document
    .querySelector("#profileForm")
    ?.addEventListener("submit", saveProfile)
  document
    .querySelector("#photoInput")
    ?.addEventListener("change", previewPhoto)
  document.querySelectorAll("[data-theme]").forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.theme = button.dataset.theme
      applyTheme()
      renderPage()
    })
  })
  document.querySelectorAll(".ticket-status").forEach((select) => {
    select.addEventListener("change", () => {
      const ticket = state.tickets.find(
        (item) => item.id === Number(select.dataset.id),
      )
      if (ticket) ticket.status = select.value
      saveState()
      showToast("Status tiket diperbarui.")
    })
  })
  document.querySelectorAll(".ticket-reply-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault()
      const ticket = state.tickets.find(
        (item) => item.id === Number(form.dataset.id),
      )
      if (!ticket) return
      ticket.reply = new FormData(form).get("reply").trim()
      ticket.repliedAt = new Date().toISOString()
      ticket.status = "Diproses"
      saveState()
      showToast("Balasan dikirim kepada pengguna.")
      renderPage()
    })
  })
  document.querySelectorAll(".reminder-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault()
      const service = serviceById(Number(form.dataset.id))
      if (!service) return
      service.reminderMessage = new FormData(form).get("message").trim()
      service.reminderSentAt = new Date().toISOString()
      saveState()
      showToast("Pengingat berhasil dikirim.")
      renderPage()
    })
  })
}

function openVehicleModal(vehicle = null) {
  openModal(
    vehicle ? "Edit kendaraan" : "Tambah kendaraan",
    `<form id="vehicleForm">
      <label class="field">Nama kendaraan<input name="name" value="${escapeAttr(vehicle?.name || "")}" required></label>
      <div class="form-grid">
        <label class="field">Nomor polisi<input name="plate" value="${escapeAttr(vehicle?.plate || "")}" required></label>
        <label class="field">Tahun<input name="year" type="number" min="1900" max="${new Date().getFullYear() + 1}" value="${vehicle?.year || ""}" required></label>
      </div>
      <label class="field">Odometer (km)<input name="odometer" type="number" min="0" value="${vehicle?.odometer ?? ""}" required></label>
      <button class="primary-btn full-btn" type="submit">Simpan kendaraan</button>
    </form>`,
  )
  document.querySelector("#vehicleForm").addEventListener("submit", async (event) => {
    event.preventDefault()
    const data = new FormData(event.target)
    const plate = data.get("plate").trim().toUpperCase()

    const newVehicleData = {
      owner_id: currentUserId,
      name: data.get("name").trim(),
      plate: plate,
      year: Number(data.get("year")),
      odometer: Number(data.get("odometer")),
      color: vehicle?.color || "#3d7165"
    }

    try {
      const response = await fetch('http://localhost:3000/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVehicleData)
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Gagal menyimpan kendaraan.")

      // Perbarui state lokal & ambil ulang data terbaru
      const resVehicles = await fetch(`http://localhost:3000/api/vehicles/${currentUserId}`)
      state.vehicles = await resVehicles.json()

      saveState()
      closeModal()
      showToast("Kendaraan berhasil disimpan ke database.")
      render()
    } catch (error) {
      showToast(error.message)
    }
  })
}

function openServiceModal(service = null, selectedVehicleId = null) {
  const vehicles = ownVehicles()
  if (!vehicles.length) {
    showToast("Tambahkan kendaraan terlebih dahulu.")
    return
  }
  openModal(
    service?.id ? "Edit catatan servis" : "Catat servis",
    `<form id="serviceForm">
      <div class="form-grid">
        <label class="field">Kendaraan
          <select name="vehicleId" required>
            ${vehicles.map((vehicle) => {
              const vId = vehicle.vehicle_id || vehicle.id_vehicle || vehicle.id;
              const isSelected = (service?.vehicleId || service?.vehicle_id || selectedVehicleId) == vId;
              return `<option value="${vId}" ${isSelected ? "selected" : ""}>${escapeHtml(vehicle.name)} —${escapeHtml(vehicle.plate)}</option>`;
            }).join("")}
          </select>
        </label>
        <label class="field">Jenis servis
          <select name="serviceTypeId">
            ${state.serviceTypes.map((type) => {
              const tId = type.id || type.id_service_type;
              return `<option value="${tId}" ${service?.serviceTypeId === tId ? "selected" : ""}>${escapeHtml(type.name)}</option>`;
            }).join("")}
          </select>
        </label>
      </div>
      <div class="form-grid">
        <label class="field">Tanggal<input name="date" type="date" value="${service?.date || todayIso()}" required></label>
        <label class="field">Kilometer<input name="odometer" type="number" min="0" value="${service?.odometer ?? ""}" required></label>
      </div>
      <label class="field">Nama bengkel<input name="workshop" value="${escapeAttr(service?.workshop || "")}" required></label>
      <div class="form-grid">
        <label class="field">Biaya (Rp)<input name="cost" type="number" min="0" value="${service?.cost ?? ""}" required></label>
        <label class="field">Status
          <select name="status">
            <option ${service?.status !== "Terjadwal" ? "selected" : ""}>Selesai</option>
            <option ${service?.status === "Terjadwal" ? "selected" : ""}>Terjadwal</option>
          </select>
        </label>
      </div>
      <label class="field">Catatan<textarea name="notes">${escapeHtml(service?.notes || "")}</textarea></label>
      <button class="primary-btn full-btn" type="submit">Simpan catatan</button>
    </form>`
  )

  document.querySelector("#serviceForm").addEventListener("submit", async (event) => {
    event.preventDefault()
    const data = new FormData(event.target)

    const selectedVehicle = Number(data.get("vehicleId"))
    if (!selectedVehicle || isNaN(selectedVehicle)) {
      showToast("Pilih kendaraan yang valid!")
      return
    }

    const newServiceData = {
      vehicle_id: selectedVehicle,
      service_type_id: Number(data.get("serviceTypeId")),
      date: data.get("date"),
      odometer: Number(data.get("odometer")),
      workshop: data.get("workshop").trim(),
      cost: Number(data.get("cost")),
      notes: data.get("notes").trim(),
      status: data.get("status")
    }

    try {
      const response = await fetch('http://localhost:3000/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServiceData)
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Gagal menyimpan catatan servis.")

      // Ambil ulang riwayat servis terbaru dari database
      const resServices = await fetch(`http://localhost:3000/api/services/${currentUserId}`)
      if (resServices.ok) {
        state.services = await resServices.json()
      }

      saveState()
      closeModal()
      showToast("Catatan servis berhasil disimpan ke database!")
      render()
    } catch (error) {
      showToast(error.message)
    }
  })
}

function openModal(title, content) {
  document.querySelector("#modalRoot").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head"><div><p class="eyebrow">VCARE</p><h2>${escapeHtml(title)}</h2></div><button class="icon-button" data-close-modal>X</button></div>
        ${content}
      </div>
    </div>`
  document
    .querySelector("[data-close-modal]")
    .addEventListener("click", closeModal)
  document
    .querySelector(".modal-backdrop")
    .addEventListener("click", (event) => {
      if (event.target.classList.contains("modal-backdrop")) closeModal()
    })
}

function closeModal() {
  const root = document.querySelector("#modalRoot")
  if (root) root.innerHTML = ""
}

function deleteVehicle(button) {
  const id = Number(button.dataset.id)
  const vehicle = vehicleById(id)
  if (!vehicle || !confirm(`Hapus ${vehicle.name} dan semua riwayat terkait?`))
    return
  state.vehicles = state.vehicles.filter((item) => item.id !== id)
  state.services = state.services.filter((item) => item.vehicleId !== id)
  saveState()
  showToast("Kendaraan dihapus.")
  render()
}

function deleteService(button) {
  const id = Number(button.dataset.id)
  if (!confirm("Hapus catatan servis ini?")) return
  state.services = state.services.filter((item) => item.id !== id)
  saveState()
  showToast("Catatan servis dihapus.")
  renderPage()
}

function verifyService(button) {
  const service = serviceById(Number(button.dataset.id))
  if (!service || !confirm("Konfirmasi bahwa servis sudah dilakukan?")) return
  service.status = "Selesai"
  service.completedAt = new Date().toISOString()
  updateVehicleOdometer(service)
  saveState()
  showToast("Servis masuk ke riwayat.")
  render()
}

function submitHelp(event) {
  event.preventDefault()
  const data = new FormData(event.target)
  state.tickets.unshift({
    id: Date.now(),
    userId: currentUserId,
    category: data.get("category"),
    subject: data.get("subject").trim(),
    message: data.get("message").trim(),
    status: "Baru",
    createdAt: new Date().toISOString(),
  })
  saveState()
  showToast("Permintaan bantuan dikirim.")
  renderPage()
}

function previewPhoto(event) {
  const file = event.target.files[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    showToast("Ukuran foto maksimal 2 MB.")
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    document.querySelector("#photoData").value = reader.result
    document.querySelector("#photoPreview").innerHTML =
      `<img src="${reader.result}" alt="Pratinjau foto">`
  }
  reader.readAsDataURL(file)
}

async function saveProfile(event) {
  event.preventDefault()
  const data = new FormData(event.target)
  const user = currentUser()
  if (!user) {
    showToast("Sesi pengguna tidak ditemukan.")
    return
  }
  const userId = user.id_user || user.id

  const updatedName = data.get("name").trim()
  const updatedEmail = data.get("email").trim()
  const updatedPhone = data.get("phone").trim()
  const updatedAvatar = document.querySelector("#photoData")?.value || ""

  try {
    const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: updatedName,
        email: updatedEmail,
        phone: updatedPhone,
        avatar: updatedAvatar
      })
    })

    const responseText = await response.text()
    let result
    try {
      result = JSON.parse(responseText)
    } catch (err) {
      throw new Error("Server backend tidak merespons dengan JSON. Pastikan server.js aktif di port 3000.")
    }

    if (!response.ok) throw new Error(result.error || "Gagal memperbarui profil.")

    // Perbarui state lokal
    user.name = updatedName
    user.email = updatedEmail
    user.phone = updatedPhone
    user.avatar = updatedAvatar
    if (state.settings) {
      state.settings.reminderDays = Number(data.get("reminderDays"))
    }

    saveState()
    showToast("Profil dan foto berhasil disimpan ke database!")
    render()
  } catch (error) {
    showToast(error.message)
  }
}

function exportData() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = `vcare-backup-${todayIso()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function resetData() {
  if (!confirm("Pulihkan seluruh data ke contoh awal?")) return
  localStorage.removeItem(STORAGE_KEY)
  const response = await fetch(new URL("./data.json", import.meta.url))
  state = await response.json()
  state.services = state.services.map((service) => ({
    ...service,
    date: service.date || dateFromToday(service.dateOffset || 0),
  }))
  saveState()
  showToast("Data contoh dipulihkan.")
  render()
}

function userReminderBanner() {
  const count = ownServices().filter(
    (service) => service.status === "Terjadwal" && service.reminderSentAt,
  ).length
  return count
    ? `<button class="notice-banner" data-page="Jenis Servis"><span class="stat-icon">N</span><span><strong>Admin mengirim pengingat servis</strong><br><small>${count} jadwal perlu diverifikasi setelah servis dilakukan.</small></span></button>`
    : ""
}

function serviceMatchesSearch(service) {
  const vehicle = vehicleById(service.vehicleId)
  const type = serviceType(service.serviceTypeId)
  return `${vehicle?.name || ""} ${vehicle?.plate || ""} ${type?.name || ""} ${service.workshop} ${service.notes}`
    .toLowerCase()
    .includes(searchTerm.toLowerCase())
}

function stat(icon, label, value, detail) {
  return `<article class="stat-card"><span class="stat-icon">${icon}</span><div><small>${label}</small><strong>${value}</strong><small>${detail}</small></div></article>`
}

function empty(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`
}

function bindClick(action, handler) {
  document.querySelectorAll(`[data-action="${action}"]`).forEach((button) => {
    button.addEventListener("click", () => handler(button))
  })
}

function currentUser() {
  return state?.users.find((user) => (user.id_user || user.id) === currentUserId) || null;
}

function ownVehicles() {
  return state.vehicles.filter((vehicle) => vehicle.owner_id === currentUserId)
}

function ownServices() {
  const ids = new Set(ownVehicles().map((vehicle) => vehicle.vehicle_id || vehicle.id))
  return state.services.filter((service) => ids.has(service.vehicleId || service.vehicle_id))
}

function overdueUserServices() {
  return state.services.filter(
    (service) =>
      service.status === "Terjadwal" &&
      service.date < todayIso() &&
      vehicleOwner(service.vehicleId)?.role === "user",
  )
}

function vehicleOwner(vehicleId) {
  const vehicle = vehicleById(vehicleId)
  return state.users.find((user) => user.id_user === vehicle?.owner_id)
}

function vehicleById(id) {
  return state.vehicles.find((vehicle) => (vehicle.vehicle_id || vehicle.id) === Number(id))
}

function serviceById(id) {
  return state.services.find((service) => service.id === id)
}

function serviceType(id) {
  return state.serviceTypes.find((type) => type.id === id)
}

function updateVehicleOdometer(service) {
  if (service.status !== "Selesai") return
  const vehicle = vehicleById(service.vehicleId)
  if (vehicle) vehicle.odometer = Math.max(vehicle.odometer, service.odometer)
}

function logout() {
  currentUserId = null
  currentPage = "Kendaraan"
  localStorage.removeItem(SESSION_KEY)
  render()
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function applyTheme() {
  document.body.classList.toggle("dark", state?.settings?.theme === "dark")
}

function showToast(message) {
  toast.textContent = message
  toast.classList.add("show")
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400)
}

function pageTitle(user) {
  return currentPage === "Kendaraan"
    ? `Selamat datang, ${user.name}`
    : currentPage
}

function avatarHtml(user) {
  if (user && user.avatar) {
    return `<div class="avatar"><img src="${user.avatar}" alt="Profil"></div>`;
  }
  const initial = user && user.name ? user.name.charAt(0).toUpperCase() : "U";
  return `<div class="avatar">${initial}</div>`;
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function dateFromToday(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function todayLabel() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date())
}

function formatDate(value) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function number(value) {
  return new Intl.NumberFormat("id-ID").format(Number(value) || 0)
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0)
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function escapeAttr(value) {
  return escapeHtml(value)
}
