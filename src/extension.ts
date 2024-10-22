// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { GitExtension, Repository } from "./git";
import { execSync } from "child_process";
import { cwd } from "process";

// 定义提交对象的类型
interface Commit {
  Commit: string;
  Author: string;
  Date: string;
  Message: string;
}

function splitCommits(inputString: string) {
  // 分割输出，按 "Commit: " 作为分隔符
  let commitEntries = inputString.split("Commit: ").slice(1);

  // 解析每条记录为对象
  const commits: Commit[] = commitEntries.map((entry) => {
    const lines = entry.trim().split("\n");
    return {
      Commit: lines[0].replace("Commit: ", "").trim(),
      Author: lines[1].replace("Author: ", "").trim(),
      Date: lines[2].replace("Date: ", "").trim(),
      Message: lines.slice(3).join("\n").replace("Message: ", "").trim(), // 处理多行消息
    };
  });
  return commits;
}

function getGitExtension() {
  const vscodeGit = vscode.extensions.getExtension<GitExtension>("vscode.git");
  const gitExtension = vscodeGit && vscodeGit.exports;
  return gitExtension && gitExtension.getAPI(1);
}

function getRecentCommits() {
  // 检测是否有路径
  const rootPath = vscode.workspace.rootPath;
  if (!rootPath) {
    vscode.window.showErrorMessage(
      "No workspace opened. Please open a workspace with a Git repository."
    );
    return [];
  }
  // 打印当前工作目录
  console.log("当前工作目录:", cwd());
  process.chdir(rootPath);

  try {
    // 执行 git log 命令并获取输出
    const logOutput = execSync(
      'git log -20 --pretty=format:"Commit: %H%nAuthor: %an <%ae>%nDate: %ad%nMessage: %B%n" --date=short',
      { encoding: "utf-8" }
    );
    // 解析每条记录为对象
    const commits = splitCommits(logOutput);
    return commits;
  } catch (error) {
    console.error(`执行出错: ${error}`);
    return [];
  }
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.source-control.commit",
    (uri) => {
      const git = getGitExtension();
      if (!git) {
        vscode.window.showErrorMessage("Unable to load Git Extension");
        return;
      }
      // 拿到最近20个commit
      const commits = getRecentCommits();
      if (!commits || commits.length === 0) {
        vscode.window.showInformationMessage(
          "No commits found or failed to retrieve commits."
        );
        return [];
      }
      vscode.window
        .showQuickPick(
          commits.map((commit) => commit.Message.replace("Message: ", "")),
          {
            placeHolder: "Select a commit",
          }
        )
        .then(function (userSelection) {
          if (userSelection) {
            const selectedCommit = commits.find(
              (commit) => commit.Message === userSelection
            );
            if (selectedCommit) {
              const msg = selectedCommit.Message;
              const cmt = selectedCommit.Commit.replace("Commit: ", "");
              vscode.env.clipboard.writeText(cmt);
              vscode.window.showInformationMessage(
                "Commit message copied to clipboard."
              );
              if (uri) {
                const uriPath = uri._rootUri?.path || uri.rootUri.path;
                let selectedRepository = git.repositories.find(
                  (repository) => repository.rootUri.path === uriPath
                );
                if (selectedRepository) {
                  selectedRepository.inputBox.value = msg;
                }
              } else {
                for (let repo of git.repositories) {
                  repo.inputBox.value = msg;
                }
              }
            }
          }
          vscode.window.showInformationMessage("Thanks to use Commit Plus!");
        });
    }
  );
  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
