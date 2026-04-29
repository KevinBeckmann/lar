/**
 * Firebase Firestore – real-time create / update
 *
 * Uses the Firebase Web SDK v10 (modular, CDN-loaded).
 * Collection: "itens"  Fields: texto (string), done (boolean), createdAt (serverTimestamp)
 */

import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ─── Config ──────────────────────────────────────────────── */
/*
 * Firebase web API keys are intentionally public (they identify the project,
 * not authenticate a user). Protect your data with Firestore Security Rules
 * and, for production, Firebase App Check.
 * See: https://firebase.google.com/docs/projects/api-keys
 */
const firebaseConfig = {
  apiKey:            "AIzaSyAVLNZy3yITG2cChlyKCx8qju-8ziK9fhw",
  authDomain:        "laar-aecef.firebaseapp.com",
  projectId:         "laar-aecef",
  storageBucket:     "laar-aecef.firebasestorage.app",
  messagingSenderId: "696633915162",
  appId:             "1:696633915162:web:dbc1b9ca815cab07565ea3",
  measurementId:     "G-4V2TH50N06",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* Analytics is optional – silently skip if it fails (e.g. ad-blockers) */
try { getAnalytics(app); } catch (_) {}

/* ─── Helpers ─────────────────────────────────────────────── */

/**
 * Add a new item to the "itens" collection.
 * @param {string} texto
 * @returns {Promise<import("firebase/firestore").DocumentReference>}
 */
export function addItem(texto) {
  return addDoc(collection(db, "itens"), {
    texto,
    done:      false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Update an existing item.
 * @param {string} id  – Firestore document id
 * @param {{ texto?: string, done?: boolean }} fields
 */
export function updateItem(id, fields) {
  return updateDoc(doc(db, "itens", id), fields);
}

/**
 * Subscribe to real-time updates on the "itens" collection,
 * ordered by createdAt descending.
 *
 * @param {(items: Array<{id:string, texto:string, done:boolean, createdAt:any}>) => void} onUpdate
 * @param {(err: Error) => void} [onError]
 * @returns {() => void}  unsubscribe function
 */
export function subscribeItems(onUpdate, onError) {
  const q = query(collection(db, "itens"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate(items);
    },
    (err) => {
      console.error("[Firebase] onSnapshot error:", err);
      if (onError) onError(err);
    }
  );
}

/* ─── UI ──────────────────────────────────────────────────── */

/**
 * Render one <li> for an item.
 * @param {{ id:string, texto:string, done:boolean }} item
 * @param {HTMLUListElement} lista
 */
function renderItem(item, lista) {
  const li = document.createElement("li");
  li.className  = "fb-item";
  li.dataset.id = item.id;

  const check = document.createElement("input");
  check.type    = "checkbox";
  check.checked = !!item.done;
  check.setAttribute("aria-label", "Concluído");

  const input = document.createElement("input");
  input.type  = "text";
  input.value = item.texto ?? "";
  input.setAttribute("aria-label", "Texto do item");
  if (item.done) input.classList.add("fb-done");

  const btnSave = document.createElement("button");
  btnSave.type      = "button";
  btnSave.className = "btn small";
  btnSave.textContent = "Salvar";

  btnSave.addEventListener("click", async () => {
    try {
      await updateItem(item.id, { texto: input.value, done: check.checked });
    } catch (err) {
      console.error("[Firebase] updateItem error:", err);
      showFbError("Erro ao salvar item.");
    }
  });

  check.addEventListener("change", () => {
    input.classList.toggle("fb-done", check.checked);
  });

  li.append(check, input, btnSave);
  lista.appendChild(li);
}

/**
 * Initialise the Firebase UI block that is already in index.html.
 * Called once the DOM is ready.
 */
function initFirebaseUI() {
  const form   = document.getElementById("fb-form");
  const campo  = document.getElementById("fb-campo");
  const lista  = document.getElementById("fb-lista");
  const status = document.getElementById("fb-status");

  if (!form || !campo || !lista || !status) return; // section not present

  /* Submit: add new item */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const txt = campo.value.trim();
    if (!txt) return;
    try {
      await addItem(txt);
      campo.value = "";
    } catch (err) {
      console.error("[Firebase] addItem error:", err);
      showFbError("Erro ao adicionar item.");
    }
  });

  /* Real-time listener */
  status.textContent = "Conectando…";
  subscribeItems(
    (items) => {
      status.textContent = "";
      lista.innerHTML    = "";
      if (items.length === 0) {
        status.textContent = "Nenhum item ainda. Adicione um acima.";
        return;
      }
      items.forEach((item) => renderItem(item, lista));
    },
    () => showFbError("Erro ao carregar itens em tempo real.")
  );
}

function showFbError(msg) {
  const status = document.getElementById("fb-status");
  if (status) status.textContent = msg;
}

/* Boot */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFirebaseUI);
} else {
  initFirebaseUI();
}
