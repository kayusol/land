# 進化星球前端 — 部署说明

## 一、本地构建

在项目根目录执行：

```bash
npm install
npm run build
```

构建完成后会生成 **`dist/`** 目录，里面是所有静态文件（HTML、JS、CSS 等）。

---

## 二、部署到自己的服务器（Nginx）

### 1. 上传文件

把 **整个 `dist/` 目录** 上传到服务器，例如放到 `/var/www/evo-land`。

```bash
# 本地（在项目目录）
npm run build
scp -r dist/* 用户@服务器IP:/var/www/evo-land/
```

或用 FTP、Git 等方式把 `dist/` 里的内容放到服务器目录。

### 2. Nginx 配置示例

在服务器上编辑 Nginx 配置（如 `/etc/nginx/sites-available/evo-land`）：

```nginx
server {
    listen 80;
    server_name 你的域名或IP;
    root /var/www/evo-land;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

启用并重载 Nginx：

```bash
sudo ln -s /etc/nginx/sites-available/evo-land /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**说明**：`try_files ... /index.html` 保证刷新或直接打开子路径时仍由前端路由处理（单页应用必需）。

---

## 三、部署到 Apache

把 `dist/` 放到站点根目录后，在站点目录下放一个 **`.htaccess`**：

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## 四、推送到 Vercel（免费、简单）

### 方式一：通过 GitHub（推荐）

1. **把项目推到 GitHub**
   - 若还没有仓库，在 [github.com](https://github.com/new) 新建一个仓库（如 `evo-land-frontend`）。
   - 在项目根目录执行：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/你的用户名/evo-land-frontend.git
   git branch -M main
   git push -u origin main
   ```

2. **在 Vercel 里导入项目**
   - 打开 [vercel.com](https://vercel.com)，用 **GitHub 账号登录**。
   - 点击 **“Add New…” → “Project”**，在列表里选择刚推送的仓库（或 “Import” 填入仓库地址）。
   - 若提示配置：
     - **Framework Preset**：选 **Vite**（或留空）。
     - **Build Command**：`npm run build`
     - **Output Directory**：`dist`
     - **Root Directory**：留空即可。
   - 点击 **Deploy**。等一两分钟，部署完成后会得到 `https://xxx.vercel.app` 的地址。

3. **之后更新**
   - 改完代码后执行 `git add .` → `git commit -m "更新说明"` → `git push`。
   - Vercel 会自动检测推送并重新部署。

### 方式二：用 Vercel CLI 直接部署

1. 安装并登录：
   ```bash
   npm i -g vercel
   vercel login
   ```
2. 在项目根目录执行：
   ```bash
   npm run build
   vercel
   ```
   按提示选择或创建项目，完成后会给出预览地址。正式发布到生产可执行：`vercel --prod`。

**说明**：项目根目录已包含 `vercel.json`，指定了构建命令、输出目录和 SPA 路由回退，一般无需在网页里再改配置。

---

## 五、部署到 Netlify

1. 把项目推到 GitHub。
2. 打开 [netlify.com](https://netlify.com)，用 GitHub 登录。
3. “Add new site” → “Import an existing project” → 选仓库。
4. **Build command**：`npm run build`  
   **Publish directory**：`dist`
5. 保存并部署。

---

## 六、注意事项

- **环境变量**：若以后用 `.env` 配置接口地址等，在 Vercel/Netlify 要在后台填 “Environment Variables”；在 Nginx/Apache 服务器上构建时在本地或 CI 里设置好再执行 `npm run build`。
- **HTTPS**：正式环境建议用 Let’s Encrypt 等配置 HTTPS（Nginx 可用 `certbot`）。
- **链配置**：当前连接 BSC 测试网，合约地址在 `src/constants/contracts.js`；换主网或其它链需改该文件并重新构建。
