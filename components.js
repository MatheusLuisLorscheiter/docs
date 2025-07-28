// Componentes customizados para API Disparador
// Este arquivo define componentes reutilizáveis para a documentação

export const InfoCard = ({ title, description, icon, color = "#16a34a" }) => {
  return `
    <div class="info-card" style="border-left: 4px solid ${color};">
      <div class="info-card-header">
        <span class="info-card-icon">${icon}</span>
        <h3 class="info-card-title">${title}</h3>
      </div>
      <p class="info-card-description">${description}</p>
    </div>
  `;
};

export const FeatureGrid = ({ items, columns = 3 }) => {
  const gridStyle = `grid-template-columns: repeat(${columns}, 1fr);`;
  
  const itemsHtml = items.map(item => `
    <div class="feature-item">
      <div class="feature-icon" style="color: ${item.color || '#16a34a'}">${item.icon}</div>
      <h4 class="feature-title">${item.title}</h4>
      <p class="feature-description">${item.description}</p>
    </div>
  `).join('');
  
  return `
    <div class="feature-grid" style="${gridStyle}">
      ${itemsHtml}
    </div>
  `;
};

export const StatusBadge = ({ status, type = "status" }) => {
  const colors = {
    DRAFT: "#6b7280",
    SCHEDULED: "#2563eb", 
    RUNNING: "#16a34a",
    PAUSED: "#ea580c",
    COMPLETED: "#059669",
    CANCELLED: "#dc2626"
  };
  
  const color = colors[status] || "#6b7280";
  
  return `
    <span class="status-badge" style="background-color: ${color};">
      ${status}
    </span>
  `;
};

export const CodeBlock = ({ language, code, title }) => {
  return `
    <div class="code-block">
      ${title ? `<div class="code-block-title">${title}</div>` : ''}
      <pre><code class="language-${language}">${code}</code></pre>
    </div>
  `;
};

export const AlertBox = ({ type, title, message }) => {
  const styles = {
    info: { bg: "#dbeafe", border: "#3b82f6", icon: "ℹ️" },
    warning: { bg: "#fef3c7", border: "#f59e0b", icon: "⚠️" },
    error: { bg: "#fee2e2", border: "#ef4444", icon: "❌" },
    success: { bg: "#dcfce7", border: "#22c55e", icon: "✅" }
  };
  
  const style = styles[type] || styles.info;
  
  return `
    <div class="alert-box" style="background-color: ${style.bg}; border-left: 4px solid ${style.border};">
      <div class="alert-header">
        <span class="alert-icon">${style.icon}</span>
        <strong class="alert-title">${title}</strong>
      </div>
      <p class="alert-message">${message}</p>
    </div>
  `;
}; 