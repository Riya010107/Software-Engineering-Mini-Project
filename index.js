const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "..", "data", "library.json");

app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

function readStore() { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
function writeStore(store) { fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2) + "\n", "utf8"); }
function makeId(prefix, collection) {
  const nums = collection.map(x => Number(String(x.id).replace(/^\D+/, ""))).filter(Number.isFinite);
  return `${prefix}${Math.max(1000, ...nums) + 1}`;
}
function clean(value, max = 120) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function today() { return new Date().toISOString().slice(0, 10); }
function plusDays(days) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function booksWithAvailability(store) {
  return store.books.map(book => {
    const issued = store.loans.filter(l => l.bookId === book.id && l.status === "Issued").length;
    return { ...book, availableCopies: Math.max(0, book.totalCopies - issued) };
  });
}
function loanView(store, loan) {
  return {
    ...loan,
    bookTitle: store.books.find(b => b.id === loan.bookId)?.title || "Deleted book",
    memberName: store.members.find(m => m.id === loan.memberId)?.name || "Deleted member"
  };
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", application: "Library Management System", version: "1.0.0" }));

app.get("/api/dashboard", (_req, res) => {
  const s = readStore();
  const active = s.loans.filter(l => l.status === "Issued");
  const available = booksWithAvailability(s).reduce((sum, b) => sum + b.availableCopies, 0);
  res.json({
    totalBooks: s.books.reduce((sum, b) => sum + b.totalCopies, 0),
    totalTitles: s.books.length, availableCopies: available, totalMembers: s.members.length,
    issuedBooks: active.length, overdueBooks: active.filter(l => l.dueDate < today()).length,
    recentLoans: s.loans.slice(-5).reverse().map(l => loanView(s, l))
  });
});

app.get("/api/books", (req, res) => {
  const s = readStore(); const q = clean(req.query.q, 100).toLowerCase();
  res.json(booksWithAvailability(s).filter(b => [b.title, b.author, b.category, b.isbn, b.id].some(v => String(v || "").toLowerCase().includes(q))));
});

app.post("/api/books", (req, res) => {
  const s = readStore();
  const title = clean(req.body.title), author = clean(req.body.author), category = clean(req.body.category, 60);
  const isbn = clean(req.body.isbn, 30), totalCopies = Number(req.body.totalCopies);
  if (!title || !author || !category || !Number.isInteger(totalCopies) || totalCopies < 1 || totalCopies > 10000)
    return res.status(400).json({ error: "Enter a title, author, category and a valid number of copies (1–10000)." });
  if (isbn && s.books.some(b => b.isbn === isbn)) return res.status(409).json({ error: "A book with this ISBN already exists." });
  const book = { id: makeId("B", s.books), title, author, category, isbn, totalCopies };
  s.books.push(book); writeStore(s); res.status(201).json({ ...book, availableCopies: totalCopies });
});

app.put("/api/books/:id", (req, res) => {
  const s = readStore(); const book = s.books.find(b => b.id === req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found." });
  const title = clean(req.body.title), author = clean(req.body.author), category = clean(req.body.category, 60);
  const isbn = clean(req.body.isbn, 30), totalCopies = Number(req.body.totalCopies);
  const issued = s.loans.filter(l => l.bookId === book.id && l.status === "Issued").length;
  if (!title || !author || !category || !Number.isInteger(totalCopies) || totalCopies < issued || totalCopies > 10000)
    return res.status(400).json({ error: `Enter valid details. Total copies cannot be less than ${issued} currently issued copy/copies.` });
  if (isbn && s.books.some(b => b.id !== book.id && b.isbn === isbn)) return res.status(409).json({ error: "Another book already uses this ISBN." });
  Object.assign(book, { title, author, category, isbn, totalCopies }); writeStore(s);
  res.json({ ...book, availableCopies: totalCopies - issued });
});

app.delete("/api/books/:id", (req, res) => {
  const s = readStore();
  if (s.loans.some(l => l.bookId === req.params.id && l.status === "Issued"))
    return res.status(409).json({ error: "This book has an active issue. Return it before deleting the title." });
  const old = s.books.length; s.books = s.books.filter(b => b.id !== req.params.id);
  if (s.books.length === old) return res.status(404).json({ error: "Book not found." });
  writeStore(s); res.json({ message: "Book deleted." });
});

app.get("/api/members", (req, res) => {
  const s = readStore(); const q = clean(req.query.q, 100).toLowerCase();
  res.json(s.members.filter(m => [m.name, m.email, m.phone, m.id].some(v => String(v || "").toLowerCase().includes(q))));
});
app.post("/api/members", (req, res) => {
  const s = readStore(); const name = clean(req.body.name), email = clean(req.body.email, 160).toLowerCase(), phone = clean(req.body.phone, 20);
  if (!name || !validEmail(email) || !/^[0-9+\-\s()]{7,20}$/.test(phone)) return res.status(400).json({ error: "Enter a name, valid email address and phone number." });
  if (s.members.some(m => m.email.toLowerCase() === email)) return res.status(409).json({ error: "A member with this email already exists." });
  const member = { id: makeId("M", s.members), name, email, phone }; s.members.push(member); writeStore(s);
  res.status(201).json(member);
});
app.delete("/api/members/:id", (req, res) => {
  const s = readStore();
  if (s.loans.some(l => l.memberId === req.params.id && l.status === "Issued")) return res.status(409).json({ error: "This member has an active issue. Return the book before deleting the member." });
  const old = s.members.length; s.members = s.members.filter(m => m.id !== req.params.id);
  if (s.members.length === old) return res.status(404).json({ error: "Member not found." });
  writeStore(s); res.json({ message: "Member deleted." });
});

app.get("/api/loans", (req, res) => {
  const s = readStore(); const status = clean(req.query.status, 20);
  let loans = s.loans.map(l => loanView(s, l)).reverse();
  if (status === "Issued" || status === "Returned") loans = loans.filter(l => l.status === status);
  res.json(loans);
});
app.post("/api/loans", (req, res) => {
  const s = readStore(); const book = s.books.find(b => b.id === req.body.bookId); const member = s.members.find(m => m.id === req.body.memberId);
  if (!book) return res.status(404).json({ error: "Select a valid book." });
  if (!member) return res.status(404).json({ error: "Select a valid member." });
  const issued = s.loans.filter(l => l.bookId === book.id && l.status === "Issued").length;
  if (issued >= book.totalCopies) return res.status(409).json({ error: "No copies of this book are currently available." });
  const dueDate = clean(req.body.dueDate, 10) || plusDays(14);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < today()) return res.status(400).json({ error: "Due date must be today or a future date." });
  const loan = { id: makeId("L", s.loans), bookId: book.id, memberId: member.id, issueDate: today(), dueDate, returnDate: null, status: "Issued" };
  s.loans.push(loan); writeStore(s); res.status(201).json(loanView(s, loan));
});
app.patch("/api/loans/:id/return", (req, res) => {
  const s = readStore(); const loan = s.loans.find(l => l.id === req.params.id);
  if (!loan) return res.status(404).json({ error: "Issue record not found." });
  if (loan.status === "Returned") return res.status(409).json({ error: "This book has already been returned." });
  loan.status = "Returned"; loan.returnDate = today(); writeStore(s); res.json(loanView(s, loan));
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: "Unexpected server error." }); });
app.listen(PORT, () => console.log(`Library Management System running at http://localhost:${PORT}`));
