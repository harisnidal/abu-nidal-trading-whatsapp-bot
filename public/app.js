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

async function loadStats() {
  const stats = await fetchJson("/api/stats");
  document.querySelector("#stat-total").textContent = stats.total;
  document.querySelector("#stat-pending").textContent = stats.byStatus.pending || 0;
  document.querySelector("#stat-fulfilled").textContent = stats.byStatus.fulfilled || 0;
  document.querySelector("#stat-cancelled").textContent = stats.byStatus.cancelled || 0;
  document.querySelector("#stat-conversion").textContent =
    stats.conversionRate === null ? "—" : `${Math.round(stats.conversionRate * 100)}%`;
}

async function loadOrders() {
  const orders = await fetchJson("/api/orders");
  const tbody = document.querySelector("#orders-table tbody");
  tbody.innerHTML = "";
  for (const o of orders) {
    const statusSelect = el("select", {
      value: o.status,
      onchange: async (e) => {
        await fetchJson(`/api/orders/${o.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: e.target.value }),
        });
        loadStats();
      },
    });
    for (const status of ["pending", "confirmed", "cancelled", "fulfilled"]) {
      statusSelect.append(el("option", { value: status, text: status, selected: status === o.status }));
    }

    tbody.append(
      el("tr", {}, [
        el("td", { textContent: o.created_at }),
        el("td", { textContent: o.customer_name || "—" }),
        el("td", { textContent: o.customer_phone }),
        el("td", { textContent: o.product }),
        el("td", { textContent: o.quantity }),
        el("td", { textContent: o.notes || "" }),
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

loadStats();
loadOrders();
loadCustomers();
setInterval(() => {
  loadStats();
  loadOrders();
  loadCustomers();
}, 15000);
