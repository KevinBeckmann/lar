# LTK • Contas da Casa

Aplicativo web PWA para controle de contas domésticas, com sincronização em tempo real via **Cloud Firestore** (Firebase).

---

## Funcionalidades

- Adicionar, editar, duplicar e excluir contas
- Filtros por mês, status (pago / em aberto / atrasado) e categoria
- KPIs do mês (total, pago, a pagar)
- Gráfico de gastos por categoria
- Dados de exemplo (seed) e exportação/importação JSON
- Sincronização em tempo real entre dispositivos via Firestore
- PWA instalável com Service Worker

---

## Estrutura do Firestore

### Coleção: `bills`

Cada documento representa uma conta e possui os seguintes campos:

| Campo           | Tipo                  | Descrição                                              |
|-----------------|-----------------------|--------------------------------------------------------|
| `id`            | `string`              | Identificador único (mesmo que o ID do documento)      |
| `name`          | `string`              | Nome da conta (ex: Aluguel, Luz)                       |
| `category`      | `string`              | Categoria (ex: Moradia, Energia/Água)                  |
| `due`           | `string` (YYYY-MM-DD) | Data de vencimento                                     |
| `amount`        | `number`              | Valor em R$                                            |
| `paymentMethod` | `string`              | Forma de pagamento (Pix, Cartão, Boleto…)              |
| `recurring`     | `boolean`             | Se é uma conta recorrente                              |
| `paid`          | `boolean`             | Se a conta já foi paga                                 |
| `createdAt`     | `Timestamp`           | Data/hora de criação — definida apenas na criação      |
| `updatedAt`     | `Timestamp`           | Data/hora da última atualização — atualizada em edições|

#### Semântica de `createdAt` e `updatedAt`

- **`createdAt`** é definido via `serverTimestamp()` **somente quando o documento é criado pela primeira vez**. Ele nunca é sobrescrito em edições posteriores. A listagem de contas é ordenada por `createdAt` decrescente (mais recentes primeiro).
- **`updatedAt`** é definido via `serverTimestamp()` **em toda operação de escrita** (criação e edição). Permite rastrear quando um documento foi modificado pela última vez.

---

## Configuração Firebase

O arquivo `app.js` contém as credenciais do projeto Firebase. Para usar em seu próprio projeto:

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
2. Ative o **Cloud Firestore** (modo de teste para desenvolvimento)
3. Substitua o objeto `firebaseConfig` em `app.js` pelas suas credenciais

---

## Regras do Firestore

### ⚠️ Apenas para desenvolvimento

As regras abaixo permitem leitura e escrita sem autenticação. **Nunca use em produção.**

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Produção recomendada

Em produção, restrinja o acesso por autenticação:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bills/{billId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Reset em nuvem (cuidado)

O botão **Limpar** apaga **todos** os documentos da coleção `bills` no Firestore — isso afeta todos os dispositivos e usuários que compartilham o mesmo projeto Firebase.

Para evitar exclusões acidentais em produção, defina a constante no topo de `app.js`:

```js
const DISABLE_CLOUD_RESET = true;
```

Com esta flag ativada, o botão Limpar exibirá uma mensagem de aviso e não realizará nenhuma exclusão.

Mesmo com a flag desativada (`false`), o reset exige uma confirmação em duas etapas:
1. Um diálogo de confirmação inicial.
2. O usuário deve digitar exatamente `APAGAR` (maiúsculas, sem espaços) para prosseguir.

---

## Como executar localmente

Por usar `type="module"` e importações via CDN do Firebase, o arquivo deve ser servido por um servidor HTTP (não funciona abrindo `file://` diretamente):

```bash
# Opção 1: npx serve
npx serve .

# Opção 2: Python
python3 -m http.server 8080
```

Acesse `http://localhost:8080` (ou porta equivalente) no navegador.
