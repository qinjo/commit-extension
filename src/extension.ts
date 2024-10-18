// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { GitExtension, Repository } from "./git";
import { execSync } from "child_process";

function splitCommits(inputString: string) {
  // 正则表达式匹配以“----    ”开始，以“----”结束的字符串
  const regex = /----\s{4}(.*?)----/g;
  const matches = [];
  let match;
  // 使用正则表达式的 exec 方法来循环查找所有匹配项
  while ((match = regex.exec(inputString)) !== null) {
    matches.push(match[1].trim().replace(/--\s{2}/g, ""));
  }
  return matches;
}

function getGitExtension() {
  const vscodeGit = vscode.extensions.getExtension<GitExtension>("vscode.git");
  const gitExtension = vscodeGit && vscodeGit.exports;
  return gitExtension && gitExtension.getAPI(1);
}

function getRecentCommits() {
  const rootPath = vscode.workspace.rootPath;
  if (!rootPath) {
    vscode.window.showErrorMessage(
      "No workspace opened. Please open a workspace with a Git repository."
    );
    return [];
  }
  // 打印当前工作目录
  // console.log("当前工作目录:", cwd());
  process.chdir(rootPath);
  // 再次打印工作目录确认更改
  // console.log("更改后的工作目录:", cwd());

  try {
    const output = execSync("git log -20", { encoding: "utf-8" });
    return splitCommits(output.replace(/(\r\n|\n|\r)/gm, "--"));
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
      // 拿到最近10个commit
      const commits = getRecentCommits();
      if (!commits || commits.length === 0) {
        vscode.window.showInformationMessage(
          "No commits found or failed to retrieve commits."
        );
        return [];
      }
      vscode.window
        .showQuickPick(
          commits.map((commit) => commit),
          {
            placeHolder: "Select a commit",
          }
        )
        .then(function (userSelection) {
          if (userSelection) {
            const selectedCommit = commits.find(
              (commit) => commit === userSelection
            );
            if (selectedCommit) {
              const str = selectedCommit.replace(/\s{2}/g, "\n");
              vscode.env.clipboard.writeText(str);
              vscode.window.showInformationMessage(
                "Commit message copied to clipboard."
              );
              if (uri) {
                const uriPath = uri._rootUri?.path || uri.rootUri.path;
                let selectedRepository = git.repositories.find(
                  (repository) => repository.rootUri.path === uriPath
                );
                if (selectedRepository) {
                  selectedRepository.inputBox.value = str;
                }
              } else {
                for (let repo of git.repositories) {
                  repo.inputBox.value = str;
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

// 在扩展激活时注册命令
// vscode.commands.registerCommand('extension.showRecentCommits', showCommitsQuickPick);

// This method is called when your extension is deactivated
export function deactivate() {}
