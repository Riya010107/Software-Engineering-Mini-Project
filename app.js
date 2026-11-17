const $ = (selector) => document.querySelector(selector);
const state = { books: [], members: [], loans: [], filter: "All", toastTimer: null };

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
function goTo(view) {
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));
  document.querySelectorAll(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  const names = { dashboard: "Dashboard", books: "Books", members: "Members", circulation: "Issue & Returns" };
  $("#currentSection").textContent = names[view] || "Dashboard";
  $("#sidebar").classList.remove("open"); window.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "circulation") loadCirculation().catch(err => showToast(err.message));
}
function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function statusMarkup(loan) {
  const overdue = loan.status === "Issued" && loan.dueDate < new Date().toISOString().slice(0, 10);
  if (overdue) return '<span class="status overdue">Overdue</span>';
  return loan.status === "Returned" ? '<span class="status returned">Returned</span>' : '<span class="status issued">Issued</span>';
}

async function loadDashboard() {
  const data = await api("/api/dashboard");
  $("#statTotalBooks").textContent = data.totalBooks;
  $("#statAvailable").textContent = data.availableCopies;
  $("#statMembers").textContent = data.totalMembers;
  $("#statIssued").textContent = data.issuedBooks;
  $("#statOverdue").textContent = `${data.overdueBooks} overdue`;
  const rows = data.recentLoans.map(loan => `
    <tr><td><div class="book-name"><strong>${escapeHtml(loan.bookTitle)}</strong><small>${escapeHtml(loan.memberName)}</small></div></td>
    <td>${formatDate(loan.issueDate)}</td><td>${formatDate(loan.dueDate)}</td><td>${statusMarkup(loan)}</td></tr>`).join("");
  $("#recentLoans").innerHTML = rows || '<tr><td colspan="4" class="empty-cell">No circulation records yet.</td></tr>';
}
async function loadBooks(query = "") {
  state.books = await api(`/api/books?q=${encodeURIComponent(query)}`);
  $("#bookCountLabel").textContent = `${state.books.length} title${state.books.length === 1 ? "" : "s"} found`;
  $("#booksTable").innerHTML = state.books.map(book => `
    <tr><td><div class="book-cell"><span class="book-cover">${escapeHtml(book.title.slice(0, 1).toUpperCase())}</span><span class="book-name"><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.author)} · ${escapeHtml(book.id)}</small></span></div></td>
    <td><span class="category-pill">${escapeHtml(book.category)}</span></td><td>${escapeHtml(book.isbn || "—")}</td>
    <td>${book.totalCopies}</td><td><strong>${book.availableCopies}</strong></td>
    <td><button class="action-link" data-edit-book="${escapeHtml(book.id)}">Edit</button><button class="action-link danger" data-delete-book="${escapeHtml(book.id)}">Delete</button></td></tr>`).join("") || '<tr><td colspan="6" class="empty-cell">No books match your search.</td></tr>';
  populateBookSelect();
}
async function loadMembers(query = "") {
  state.members = await api(`/api/members?q=${encodeURIComponent(query)}`);
  $("#memberCountLabel").textContent = `${state.members.length} member${state.members.length === 1 ? "" : "s"} found`;
  $("#membersTable").innerHTML = state.members.map(member => `
    <tr><td><div class="member-cell"><span class="book-cover">${escapeHtml(member.name.slice(0, 1).toUpperCase())}</span><span class="member-name"><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.id)}</small></span></div></td>
    <td>${escapeHtml(member.email)}</td><td>${escapeHtml(member.phone)}</td><td>${escapeHtml(member.id)}</td>
    <td><button class="action-link danger" data-delete-member="${escapeHtml(member.id)}">Remove</button></td></tr>`).join("") || '<tr><td colspan="5" class="empty-cell">No members match your search.</td></tr>';
  populateMemberSelect();
}
function populateBookSelect() {
  const select = $("#issueBook"), current = select.value;
  const available = state.books.filter(book => book.availableCopies > 0);
  select.innerHTML = '<option value="">Choose an available book</option>' + available.map(book =>
    `<option value="${escapeHtml(book.id)}">${escapeHtml(book.title)} (${book.availableCopies} available)</option>`).join("");
  if (available.some(book => book.id === current)) select.value = current;
}
function populateMemberSelect() {
  const select = $("#issueMember"), current = select.value;
  select.innerHTML = '<option value="">Choose a member</option>' + state.members.map(member =>
    `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)}</option>`).join("");
  if (state.members.some(member => member.id === current)) select.value = current;
}
async function loadCirculation() {
  state.loans = await api("/api/loans");
  const visible = state.filter === "All" ? state.loans : state.loans.filter(loan => loan.status === state.filter);
  $("#loansTable").innerHTML = visible.map(loan => `
    <tr><td><div class="book-name"><strong>${escapeHtml(loan.bookTitle)}</strong><small>${escapeHtml(loan.memberName)} · ${escapeHtml(loan.id)}</small></div></td>
    <td>${formatDate(loan.issueDate)}</td><td>${formatDate(loan.dueDate)}</td><td>${formatDate(loan.returnDate)}</td>
    <td>${statusMarkup(loan)}</td><td>${loan.status === "Issued" ? `<button class="action-link" data-return-loan="${escapeHtml(loan.id)}">Mark returned</button>` : "—"}</td></tr>`).join("") || '<tr><td colspan="6" class="empty-cell">No records in this view.</td></tr>';
}
function resetBookForm() {
  $("#bookForm").reset(); $("#bookId").value = ""; $("#bookCopies").value = 1;
  $("#bookFormTitle").textContent = "Add a new book"; $("#saveBookButton").textContent = "Save book";
}
function showBookForm() { $("#bookFormPanel").classList.remove("hidden"); $("#bookFormPanel").scrollIntoView({ behavior: "smooth", block: "start" }); }
function hideBookForm() { $("#bookFormPanel").classList.add("hidden"); }

function bindEvents() {
  document.querySelectorAll(".nav-link").forEach(button => button.addEventListener("click", () => goTo(button.dataset.view)));
  document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => goTo(button.dataset.go)));
  $("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#todayLabel").textContent = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const defaultDue = new Date(); defaultDue.setDate(defaultDue.getDate() + 14);
  $("#issueDueDate").value = defaultDue.toISOString().slice(0, 10); $("#issueDueDate").min = new Date().toISOString().slice(0, 10);

  $("#toggleBookForm").addEventListener("click", () => { resetBookForm(); showBookForm(); });
  $("#closeBookForm").addEventListener("click", hideBookForm); $("#cancelBookForm").addEventListener("click", hideBookForm);
  $("#toggleMemberForm").addEventListener("click", () => $("#memberFormPanel").classList.toggle("hidden"));
  $("#closeMemberForm").addEventListener("click", () => $("#memberFormPanel").classList.add("hidden"));
  $("#cancelMemberForm").addEventListener("click", () => $("#memberFormPanel").classList.add("hidden"));

  $("#bookForm").addEventListener("submit", async event => {
    event.preventDefault(); const id = $("#bookId").value;
    const payload = { title: $("#bookTitle").value, author: $("#bookAuthor").value, category: $("#bookCategory").value, isbn: $("#bookIsbn").value, totalCopies: Number($("#bookCopies").value) };
    try {
      await api(id ? `/api/books/${id}` : "/api/books", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
      hideBookForm(); resetBookForm(); await refreshAll(); showToast(id ? "Book details updated." : "Book added to the catalogue.");
    } catch (error) { showToast(error.message); }
  });
  $("#booksTable").addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit-book]"), del = event.target.closest("[data-delete-book]");
    if (edit) {
      const book = state.books.find(item => item.id === edit.dataset.editBook); if (!book) return;
      $("#bookId").value = book.id; $("#bookTitle").value = book.title; $("#bookAuthor").value = book.author;
      $("#bookCategory").value = book.category; $("#bookIsbn").value = book.isbn || ""; $("#bookCopies").value = book.totalCopies;
      $("#bookFormTitle").textContent = "Edit book details"; $("#saveBookButton").textContent = "Update book"; showBookForm();
    }
    if (del && confirm("Delete this book title from the catalogue?")) {
      try { await api(`/api/books/${del.dataset.deleteBook}`, { method: "DELETE" }); await refreshAll(); showToast("Book deleted."); }
      catch (error) { showToast(error.message); }
    }
  });

  $("#memberForm").addEventListener("submit", async event => {
    event.preventDefault(); const payload = { name: $("#memberName").value, email: $("#memberEmail").value, phone: $("#memberPhone").value };
    try {
      await api("/api/members", { method: "POST", body: JSON.stringify(payload) }); $("#memberForm").reset(); $("#memberFormPanel").classList.add("hidden");
      await refreshAll(); showToast("Member registered successfully.");
    } catch (error) { showToast(error.message); }
  });
  $("#membersTable").addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-member]"); if (!button || !confirm("Remove this member?")) return;
    try { await api(`/api/members/${button.dataset.deleteMember}`, { method: "DELETE" }); await refreshAll(); showToast("Member removed."); }
    catch (error) { showToast(error.message); }
  });
  $("#issueForm").addEventListener("submit", async event => {
    event.preventDefault(); const payload = { bookId: $("#issueBook").value, memberId: $("#issueMember").value, dueDate: $("#issueDueDate").value };
    try {
      await api("/api/loans", { method: "POST", body: JSON.stringify(payload) }); $("#issueForm").reset();
      const due = new Date(); due.setDate(due.getDate() + 14); $("#issueDueDate").value = due.toISOString().slice(0, 10);
      await refreshAll(); await loadCirculation(); showToast("Book issued successfully.");
    } catch (error) { showToast(error.message); }
  });
  $("#loansTable").addEventListener("click", async event => {
    const button = event.target.closest("[data-return-loan]"); if (!button || !confirm("Mark this book as returned?")) return;
    try { await api(`/api/loans/${button.dataset.returnLoan}/return`, { method: "PATCH" }); await refreshAll(); await loadCirculation(); showToast("Book return recorded."); }
    catch (error) { showToast(error.message); }
  });
  document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
    state.filter = button.dataset.filter; document.querySelectorAll("[data-filter]").forEach(item => item.classList.toggle("active", item === button));
    loadCirculation().catch(error => showToast(error.message));
  }));
  let bookTimer, memberTimer;
  $("#bookSearch").addEventListener("input", event => { clearTimeout(bookTimer); bookTimer = setTimeout(() => loadBooks(event.target.value).catch(err => showToast(err.message)), 180); });
  $("#memberSearch").addEventListener("input", event => { clearTimeout(memberTimer); memberTimer = setTimeout(() => loadMembers(event.target.value).catch(err => showToast(err.message)), 180); });
}
async function refreshAll() {
  await Promise.all([loadDashboard(), loadBooks($("#bookSearch").value), loadMembers($("#memberSearch").value)]);
  if ($("#view-circulation").classList.contains("active")) await loadCirculation();
}
async function init() { bindEvents(); try { await refreshAll(); } catch (error) { showToast(`Could not load library data: ${error.message}`); } }
init();
