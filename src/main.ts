import * as fs from "fs";
import * as core from "@actions/core";
import axios, {isAxiosError} from "axios";
import { deploy } from "@samkirkland/ftp-deploy";
import { IFtpDeployArguments } from "@samkirkland/ftp-deploy/dist/types";
import { optionalInt, optionalProtocol, optionalString, optionalBoolean, optionalStringArray, optionalLogLevel, optionalSecurity } from "./parse";

async function validateSubscription() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  let repoPrivate: boolean | undefined;

  if (eventPath && fs.existsSync(eventPath)) {
    const eventData = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    repoPrivate = eventData?.repository?.private;
  }

  const upstream = "samkirkland/ftp-deploy-action";
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const docsUrl = "https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions";

  core.info("");
  core.info("\u001b[1;36mStepSecurity Maintained Action\u001b[0m");
  core.info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false) core.info("\u001b[32m✓ Free for public repositories\u001b[0m");
  core.info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`);
  core.info("");

  if (repoPrivate === false) return;

  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  const body: Record<string, string> = { action: action || "" };
  if (serverUrl !== "https://github.com") body.ghes_server = serverUrl;
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body, { timeout: 3000 }
    );
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      core.error(`\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`);
      core.error(`\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`);
      process.exit(1);
    }
    core.info("Timeout or API not reachable. Continuing to next step.");
  }
}

async function runDeployment() {
  await validateSubscription();

  try {
    const args: IFtpDeployArguments = {
      server: core.getInput("server", { required: true }),
      username: core.getInput("username", { required: true }),
      password: core.getInput("password", { required: true }),
      port: optionalInt("port", core.getInput("port")),
      protocol: optionalProtocol("protocol", core.getInput("protocol")),
      "local-dir": optionalString(core.getInput("local-dir")),
      "server-dir": optionalString(core.getInput("server-dir")),
      "state-name": optionalString(core.getInput("state-name")),
      "dry-run": optionalBoolean("dry-run", core.getInput("dry-run")),
      "dangerous-clean-slate": optionalBoolean("dangerous-clean-slate", core.getInput("dangerous-clean-slate")),
      "exclude": optionalStringArray("exclude", core.getMultilineInput("exclude")),
      "log-level": optionalLogLevel("log-level", core.getInput("log-level")),
      "security": optionalSecurity("security", core.getInput("security")),
      "timeout": optionalInt("timeout", core.getInput("timeout"))
    };

    await deploy(args);
  }
  catch (error: any) {
    core.setFailed(error);
  }
}

runDeployment();
