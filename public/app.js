async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) node.append(child);
  return node;
}

async function loadBookings() {
  const bookings = await fetchJson("/api/bookings");
  const tbody = document.querySelector("#bookings-table tbody");
  tbody.innerHTML = "";
  for (const b of bookings) {
    const statusSelect = el("select", {
      value: b.status,
      onchange: async (e) => {
        await fetchJson(`/api/bookings/${b.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: e.target.value }),
        });
      },
    });
    for (const status of ["pending", "confirmed", "cancelled", "completed"]) {
      statusSelect.append(el("option", { value: status, text: status, selected: status === b.status }));
    }

    tbody.append(
      el("tr", {}, [
        el("td", { textContent: b.requested_time }),
        el("td", { textContent: b.customer_name || "—" }),
        el("td", { textContent: b.customer_phone }),
        el("td", { textContent: b.service }),
        el("td", { textContent: b.notes || "" }),
        el("td", {}, [statusSelect]),
      ])
    );
  }
}

async function openConversation(customer) {
  const messages = await fetchJson(`/api/customers/${customer.id}/messages`);
  document.querySelector("#conversation-customer").textContent =
    customer.name || customer.phone;
  const container = document.querySelector("#conversation-messages");
  container.innerHTML = "";
  for (const m of messages) {
    container.append(
      el("div", { className: `msg ${m.direction}`, textContent: m.body })
    );
  }
  document.querySelector("#conversation-section").hidden = false;
  document.querySelector("#conversation-section").scrollIntoView({ behavior: "smooth" });
}

async function loadCustomers() {
  const customers = await fetchJson("/api/customers");
  const tbody = document.querySelector("#customers-table tbody");
  tbody.innerHTML = "";
  for (const c of customers) {
    const viewBtn = el("button", {
      textContent: "View conversation",
      onclick: () => openConversation(c),
    });
    tbody.append(
      el("tr", {}, [
        el("td", { textContent: c.phone }),
        el("td", { textContent: c.name || "—" }),
        el("td", { textContent: c.created_at }),
        el("td", {}, [viewBtn]),
      ])
    );
  }
}

document.querySelector("#close-conversation").addEventListener("click", () => {
  document.querySelector("#conversation-section").hidden = true;
});

loadBookings();
loadCustomers();
setInterval(() => {
  loadBookings();
  loadCustomers();
}, 15000);
