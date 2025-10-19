# 🛒 E-commerce Loomi API 
Esta é uma API REST desenvolvida com NestJS e Prisma ORM, projetada para gerenciar usuários, autenticação, clientes, produtos e pedidos em um sistema de e-commerce.

---

## 🌟 Funcionalidades Principais:
A API é estruturada em torno dos seguintes módulos principais, com gerenciamento de acesso baseado em perfis (**Roles**).

### 🔑 Autenticação e Autorização (Auth):
- **Registro de Usuário:** Permite a criação de novos usuários com perfis **ADMIN** ou **CLIENT**.
- **Login com JWT:** Utiliza **JSON Web Tokens (JWT)** para autenticação, garantindo que apenas usuários válidos possam acessar rotas protegidas.
- **Controle de Acesso (RBAC):** Implementa Guards de Roles para restringir o acesso a endpoints específicos com base no perfil do usuário **(ADMIN ou CLIENT)**.

### 👥 Gerenciamento de Clientes (Clients):
Este módulo permite que usuários **ADMIN** gerenciem todos os clientes e que usuários **CLIENT** gerenciem apenas seus próprios dados de cliente.
- **Criação:** Criação do perfil de cliente, ligando-o a um **User** existente.
- **Busca com Filtros:** Permite que administradores listem e filtrem clientes por nome completo, e-mail e status, utilizando paginação.
- **Atualização Controlada:** Usuários **CLIENT** podem atualizar seus dados pessoais, mas apenas **ADMINS** podem alterar o status do cliente (ativo/inativo).

### 🛍️ Gerenciamento de Produtos (Products):
Este módulo lida com a manutenção do catálogo de produtos e permite a consulta por qualquer usuário autenticado.
- **CRUD Completo (ADMIN):** Somente usuários **ADMIN** podem criar, atualizar e deletar produtos.
- **Consulta Avançada:** Clientes e administradores podem buscar produtos com filtros avançados, incluindo nome, faixas de preço (minPrice, maxPrice) e disponibilidade de estoque (available).
- **Controle de Estoque:** Impede a criação ou atualização de produtos com estoque negativo.

### 📦 Pedidos e Carrinho de Compras (Orders):
Este é o módulo central do e-commerce, lidando com o ciclo de vida completo do pedido.
- **Funcionalidade de Carrinho (CART):**
  - **Adicionar/Remover:** Permite adicionar ou remover produtos e quantidades de um carrinho de compras ativo (status: CART).
  - **Get Cart:** Retorna o estado atual do carrinho.
  - **Remoção Inteligente:** Remove um item completamente se a quantidade removida for maior ou igual à quantidade atual. Se o carrinho ficar vazio, ele é deletado.
- **Finalização de Pedido (Checkout):**
  - Converte o **CART** para **ORDERED** em uma transação atômica para garantir a consistência dos dados.
  - **Verificação e Baixa de Estoque:** Na finalização, verifica se há estoque suficiente para todos os itens e, em caso positivo, dá baixa no estoque dos produtos.
- **Gerenciamento de Status:** Permite a atualização do status do pedido (ORDERED, PREPARING, SHIPPED, etc.) com regras de acesso:
  - **ADMIN:** Pode definir todos os status (e.g., PREPARING, SHIPPED).
  - **CLIENT:** Pode apenas confirmar o recebimento (RECEIVED) ou cancelar (CANCELED).
  - A transição para **PREPARING** também realiza a baixa de estoque, se ainda não tiver ocorrido.
- **Busca de Pedidos:** Permite filtrar pedidos por status e intervalo de datas. Clientes só podem ver seus próprios pedidos; Administradores veem todos.

---

## ⚙️ Configuração e Execução do Projeto:
**1. Pré-requisitos:**
  - Você deve ter o **Node.js** e o **Docker** instalados em sua máquina.
    
**2. Banco de Dados:**
  - Suba o container do banco de dados PostgreSQL usando o Docker Compose:
  ```
    docker-compose up -d
  ```
  - **Nota:** Certifique-se de que seu arquivo .env tenha a variável DATABASE_URL configurada corretamente para o container do Docker.

**3. Instalação de Dependências:**
  - Instale todas as dependências do projeto:
    ```
      npm install
    ```

**4. Aplicação de Migrações (Prisma):**
  - Gere o cliente Prisma e aplique as migrações no banco de dados para criar a estrutura das tabelas:
    ```
      npx prisma migrate dev --name init
    ```
    ```
      npx prisma generate
    ```

**5. Execução da API:**
  - Você pode executar o projeto em três modos:
    - ``` npm run dev ``` -  Desenvolvimento: Inicia a aplicação com hot-reload (Nest CLI watch).
    - ``` npm run prod ``` - Produção: Compila o projeto e inicia o servidor final (node dist/main).
    - ``` npm run test ``` - Testes: Executa os testes unitários (Jest).
   
**6. Documentação dos Endpoints:**
  - A documentação interativa de todos os endpoints está disponível através do Swagger UI quando a aplicação estiver rodando:
    - **🔗 Swagger URL:** http://localhost:3000/api/docs

---

## 💻 Tecnologias Utilizadas:
- **Framework:** NestJS (TypeScript);
- **Banco de Dados:** PostgreSQL;
- **ORM:** PrismaORM;
- **Autenticação:** JWT (@nestjs/jwt, bcrypt);
- **Validação:** class-validator, class-transformer;
- **Testes:** Jest;
- **Documentação API:** Swagger.

---

## 🤖 Uso de IA:
As IAs utilizadas no projeto foram: ChatGPT, Gemini e Copilot.

- ChatGPT e Gemini: Ajudou no desenvolvimento mais rápido dos testes unitários, na implementação do SanitizationPipe, RolesDecorator e RolesGuard e na implementação do carrinho de compras no mesmo módulo do Orders.
- Copilot: Ajudou em linting e erros simples no código (Copilot integrado ao VSCode).

- Exemplos de prompt:
  ```
    Como eu utilizo a biblioteca sanitize-html?
  ```
  ```
    Me ajude na padronização dos testes unitários
  ```
