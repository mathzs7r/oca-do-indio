// ============================================================
// 🏝️ Configuração da feira e contato
//      * Para mudar a feira, mexa SÓ aqui.
// ============================================================

const FEIRA = {
  // dia da feira (AAAA-MM-DD)
  data: '2026-11-13',
  // janela de retirada
  inicio: '08:00',
  fim: '12:00',
  // intervalo entre horários, em minutos
  intervalo: 30,
};

// número que recebe a mensagem no WhatsApp (formato internacional, só dígitos)
const WHATSAPP = '5542998169417';

// gera todos os horários de retirada possíveis
function horariosDaFeira() {
  const [hIni, mIni] = FEIRA.inicio.split(':').map(Number);
  const [hFim, mFim] = FEIRA.fim.split(':').map(Number);
  const minIni = hIni * 60 + mIni;
  const minFim = hFim * 60 + mFim;

  const lista = [];
  for (let m = minIni; m <= minFim; m += FEIRA.intervalo) {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    // último horário precisa deixar o pedido pronto até o fim da feira
    lista.push(`${FEIRA.data} ${h}:${mm}`);
  }
  // não permitir o último minuto fechado? deixa até fim - intervalo
  return lista.slice(0, Math.max(lista.length - 1, 1));
}

// valida "2026-11-13 09:30" (ou objeto Date/"YYYY-MM-DDTHH:mm") contra a feira
function validarRetirada(valor) {
  if (!valor) return { ok: false, motivo: 'Escolha o horário de retirada.' };

  let texto = String(valor).trim().replace('T', ' ');
  texto = texto.slice(0, 16); // "AAAA-MM-DD HH:MM"

  const horarios = horariosDaFeira();
  if (!horarios.includes(texto)) {
    return {
      ok: false,
      motivo: `Retirada apenas no dia ${FEIRA.data.split('-').reverse().join('/')}, entre ${FEIRA.inicio} e ${FEIRA.fim}.`,
    };
  }
  return { ok: true, retirada: texto };
}

module.exports = { FEIRA, WHATSAPP, horariosDaFeira, validarRetirada };
