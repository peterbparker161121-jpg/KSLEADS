// ==============================================================================
// KS LEADS — UTILITÁRIOS E FORMATAÇÃO pt-BR
// ==============================================================================

export const Utils = {
  // Formata moeda brasileira R$ 49,90
  formatCurrency(value) {
    if (typeof value !== 'number') {
      value = parseFloat(value) || 0;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  },

  // Formata data DD/MM/YYYY
  formatDate(dateInput) {
    if (!dateInput) return '-';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  },

  // Formata data e hora DD/MM/YYYY às HH:mm
  formatDateTime(dateInput) {
    if (!dateInput) return '-';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    const d = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    const t = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
    return `${d} às ${t}`;
  },

  // Formata CNPJ: 00.000.000/0000-00
  formatCNPJ(raw) {
    if (!raw) return '-';
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length !== 14) return raw;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  },

  // Formata Telefone Brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  formatPhone(raw) {
    if (!raw) return '-';
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 13 && digits.startsWith('55')) {
      const d = digits.slice(2);
      if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
      if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    }
    return raw;
  },

  // Toast / Notificação flutuante com auto-fechamento
  showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠️';
    if (type === 'warning') icon = '🔔';

    toast.innerHTML = `
      <span style="font-weight: bold;">${icon}</span>
      <span style="flex: 1;">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Copia texto para a área de transferência com feedback
  async copyToClipboard(text, successMsg = 'Copiado para a área de transferência!') {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(successMsg, 'success');
    } catch (e) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      this.showToast(successMsg, 'success');
    }
  },

  // Exportação profissional de CSV com UTF-8 BOM para compatibilidade com Microsoft Excel no Brasil
  exportToCSV(filename, rows, headers) {
    if (!rows || !rows.length) {
      this.showToast('Nenhum dado selecionado para exportação.', 'warning');
      return;
    }

    const headerKeys = Object.keys(headers);
    const headerLabels = Object.values(headers);

    const csvLines = [
      headerLabels.map(h => `"${String(h).replace(/"/g, '""')}"`).join(';')
    ];

    rows.forEach(row => {
      const line = headerKeys.map(key => {
        const val = row[key] !== undefined && row[key] !== null ? String(row[key]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(';');
      csvLines.push(line);
    });

    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.showToast(`Arquivo ${filename}.csv exportado com sucesso!`, 'success');
  },

  // Renderiza distintivo de status do WhatsApp
  renderWhatsAppBadge(status) {
    switch (status) {
      case 'confirmado':
        return '<span class="badge badge-success">✓ WhatsApp Confirmado</span>';
      case 'nao_confirmado':
        return '<span class="badge badge-warning">Não Confirmado</span>';
      case 'nao_encontrado':
        return '<span class="badge badge-danger">Não Encontrado</span>';
      default:
        return '<span class="badge badge-neutral">Indisponível</span>';
    }
  },

  // Renderiza distintivo de status de site
  renderWebsiteBadge(status, url) {
    if (status === 'site_encontrado' && url) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="badge badge-info">🌐 Site Encontrado</a>`;
    }
    return '<span class="badge badge-warning">⚠️ Site não encontrado</span>';
  },

  // Renderiza barra de oportunidade comercial
  renderOpportunityScore(score = 0) {
    const safeScore = Math.max(0, Math.min(100, parseInt(score, 10) || 0));
    let colorClass = 'var(--primary)';
    if (safeScore >= 75) colorClass = 'var(--success)';
    else if (safeScore >= 50) colorClass = 'var(--accent)';
    else if (safeScore >= 30) colorClass = 'var(--warning)';

    return `
      <div class="opp-meter" title="Índice de oportunidade para desenvolvimento de site e serviços digitais">
        <div class="opp-bar-bg">
          <div class="opp-bar-fill" style="width: ${safeScore}%; background: ${colorClass};"></div>
        </div>
        <span class="opp-score-text">${safeScore}/100</span>
      </div>
    `;
  }
};
