# 将源码交付到 GitHub

下载包已包含初始化完成的本地 Git 仓库（`.git/`、`main` 分支、首次提交）。**远程 GitHub 仓库尚未创建，也未配置远程地址**。在线工作台、本地仓库和 GitHub 远程仓库是不同入口。

建议仓库名为 `labform-physics-data`，可见性先设为私有。源表格、图片及教材相关材料的权利仍属于各自权利人，没有为整个项目统一授予开源许可证。

## 应包含的内容

`dist/`、`docs/`、`scripts/`、`tests/`、`.github/`、`README.md`、`package.json`、`start.cmd`、`.gitignore` 和 `.gitattributes`。包内 `.git/` 是专门为本地交付新建的仓库，不含原托管环境的仓库配置或历史。未包含 `.openai/`、密钥、环境文件或完整教材。

## 方式一：网页或 GitHub Desktop

1. 解压压缩包，在 GitHub Desktop 中通过 File → Add local repository 选择 `labform-physics-data` 文件夹。
2. 使用 Publish repository 发布为私有仓库。若使用 GitHub 网页创建空仓库，请仅上传源码文件，不要上传 `.git/` 目录；`.git/` 只用于本地版本管理。
3. 确认仓库主页显示中文 README，`dist/guide.html`、案例 JSON 和测试文件均存在。
4. 在本地运行下列命令检查：

```sh
npm test
npm start
```

不需要 `npm install`。打开 <http://127.0.0.1:8080/guide.html> 即可使用指南和案例。

## 方式二：Git 与 GitHub CLI

在**解压后的 `labform-physics-data` 目录**执行。仓库已初始化，不需要 `git init`。先安装 Git、GitHub CLI，并使用 `gh auth login` 登录自己的账户。

```sh
git status
gh repo create labform-physics-data --private --source=. --remote=origin --push
```

如果同名仓库已经存在，先核对现有仓库和权限，不要覆盖它。无需将令牌写进项目文件。完成后使用实际创建的 GitHub 链接查看仓库。

## 后续开发

```sh
npm run check
```

GitHub Actions 会在推送和拉取请求时执行同一检查。`npm start` 只启动本机预览；推送源码不会自动更新既有 Sites 网站。网站部署需要单独发布 `dist/` 内容。
