# 如何获取 Google Drive Client ID

## 📝 简要说明

要启用 Google Drive 集成，你需要从 Google Cloud Console 获取 OAuth 2.0 Client ID。

## 🔧 详细步骤

### 步骤 1: 进入 Google Cloud Console

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择你的项目（应该是你部署 ImgStudio 的项目）

### 步骤 2: 启用 Google Drive API

1. 在左侧菜单中，点击 **APIs & Services** > **Library**
2. 在搜索框中输入 "Google Drive API"
3. 点击 **Google Drive API**
4. 点击 **Enable** 按钮启用 API
5. 等待启用完成

### 步骤 3: 配置 OAuth 同意屏幕（如果还没配置）

1. 在左侧菜单中，点击 **APIs & Services** > **OAuth consent screen**
2. 选择用户类型：
   - **Internal**（内部）：仅供你的组织使用
   - **External**（外部）：任何人都可以使用
3. 点击 **Create**
4. 填写必填信息：
   - **App name**: ImgStudio
   - **User support email**: 你的邮箱
   - **Developer contact email**: 你的邮箱
5. 点击 **Save and Continue**
6. 在 Scopes 页面，点击 **Add or Remove Scopes**
7. 搜索并添加：`https://www.googleapis.com/auth/drive.file`
8. 点击 **Update** > **Save and Continue**
9. 如果是 External，添加测试用户（你自己的邮箱）
10. 点击 **Save and Continue** > **Back to Dashboard**

### 步骤 4: 创建 OAuth 2.0 Client ID（重要！）

1. 在左侧菜单中，点击 **APIs & Services** > **Credentials**
2. 点击顶部的 **+ CREATE CREDENTIALS**
3. 选择 **OAuth client ID**
4. 在 "Application type" 中选择 **Web application**
5. 填写信息：
   - **Name**: `ImgStudio Web Client`（可以自定义）
   
6. **Authorized JavaScript origins**（授权的 JavaScript 来源）：
   - 点击 **+ ADD URI**
   - 添加本地开发环境：`http://localhost:3000`
   - 如果有生产环境，也添加生产域名：`https://imgstudio.your-company.com`
   
7. **Authorized redirect URIs**（授权的重定向 URI）：
   - 点击 **+ ADD URI**
   - 添加：`http://localhost:3000`
   - 如果有生产环境，也添加：`https://imgstudio.your-company.com`

8. 点击 **Create**

### 步骤 5: 复制 Client ID

1. 创建完成后，会弹出一个对话框显示：
   - **Your Client ID**（你的客户端 ID）
   - **Your Client Secret**（你的客户端密钥）

2. **复制 "Your Client ID"**
   - 格式类似：`123456789012-abcdefghijklmnop.apps.googleusercontent.com`
   - **注意**：只需要复制 Client ID，不需要 Client Secret

3. 如果关闭了对话框，可以在 Credentials 页面点击你刚创建的 OAuth 2.0 Client，再次查看 Client ID

### 步骤 6: 配置环境变量

1. 在项目根目录创建或编辑 `.env.local` 文件：

```bash
# 在项目根目录
cd /Users/stephanie/Documents/img-studio

# 创建或编辑 .env.local
touch .env.local
```

2. 在 `.env.local` 文件中添加：

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=你复制的Client-ID.apps.googleusercontent.com
```

**实际例子**：
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnop.apps.googleusercontent.com
```

### 步骤 7: 重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

### 步骤 8: 验证配置

运行配置检查脚本：

```bash
npm run check-gdrive
```

如果一切正常，你会看到：
```
✅ .env.local file found
✅ NEXT_PUBLIC_GOOGLE_CLIENT_ID is set
✅ Client ID format is valid
✅ Google Drive context file exists
✅ GoogleDriveSaveDialog component exists
✅ Google Drive API actions exist
🎉 Configuration check passed!
```

## 📍 快速定位

### 如果你已经有项目，快速访问链接：

将 `YOUR_PROJECT_ID` 替换为你的项目 ID：

- **启用 Drive API**:
  ```
  https://console.cloud.google.com/apis/library/drive.googleapis.com?project=YOUR_PROJECT_ID
  ```

- **创建 OAuth Client**:
  ```
  https://console.cloud.google.com/apis/credentials?project=YOUR_PROJECT_ID
  ```

- **OAuth 同意屏幕**:
  ```
  https://console.cloud.google.com/apis/credentials/consent?project=YOUR_PROJECT_ID
  ```

## ⚠️ 重要注意事项

1. **Client ID 必须以 `NEXT_PUBLIC_` 开头**
   - 这样 Next.js 才能在浏览器中访问这个变量

2. **格式验证**
   - Client ID 格式：`数字-字符串.apps.googleusercontent.com`
   - 例如：`123456789012-abc123.apps.googleusercontent.com`

3. **域名配置**
   - 本地开发：`http://localhost:3000`
   - 生产环境：`https://your-actual-domain.com`
   - **必须完全匹配**，包括协议（http/https）

4. **重启服务器**
   - 修改 `.env.local` 后必须重启 `npm run dev`

5. **保密**
   - `.env.local` 不应该提交到 Git
   - 项目已经在 `.gitignore` 中忽略了这个文件

## 🧪 测试连接

1. 启动应用：`npm run dev`
2. 打开浏览器：`http://localhost:3000`
3. 进入 History 页面
4. 查看页面底部或侧边栏，应该看到 "Connect Google Drive" 按钮
5. 点击按钮，会打开 Google 授权页面
6. 选择你的 Google 账户并授权
7. 授权成功后，状态应该显示 "Drive Connected"

## ❓ 常见问题

### Q: 找不到 "APIs & Services"
**A**: 在 Google Cloud Console 左上角点击 ≡ 菜单图标，找到 "APIs & Services"

### Q: 创建 OAuth Client 时没有 "Web application" 选项
**A**: 你需要先配置 OAuth 同意屏幕（步骤 3）

### Q: 点击 Connect 后没有反应
**A**: 
1. 检查浏览器控制台是否有错误
2. 确认 Client ID 已正确设置
3. 确认已重启开发服务器
4. 尝试刷新页面

### Q: 授权页面显示 "Error: redirect_uri_mismatch"
**A**: 你的授权重定向 URI 配置不正确
- 检查 OAuth Client 配置中的 "Authorized redirect URIs"
- 确保包含你当前访问的域名（如 `http://localhost:3000`）

### Q: 我的项目在 Cloud Run 上，域名是什么？
**A**: 
1. 去 Cloud Run 服务页面
2. 找到你的服务 URL，类似：`https://imgstudio-xxxx.run.app`
3. 或者使用你配置的自定义域名

## 📚 相关文档

- [Google Drive API 文档](https://developers.google.com/drive/api/guides/about-sdk)
- [Google Identity Services 文档](https://developers.google.com/identity/gsi/web/guides/overview)
- [OAuth 2.0 指南](https://developers.google.com/identity/protocols/oauth2)

## 🎯 下一步

配置完成后，你可以：
1. 在 History 页面点击云上传图标保存文件到 Google Drive
2. 选择目标文件夹或创建新文件夹
3. 管理 Google Drive 连接状态

详细使用说明请查看：`GOOGLE_DRIVE_SETUP.md`
