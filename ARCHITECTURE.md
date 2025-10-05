# Architecture and Functionality Guidelines

## Architecture
- This is a typescript application running on node, etc.
- This application will use the Claude Agent SDK - https://docs.claude.com/en/api/agent-sdk/overview - to power the agent doing the work for the application.
- The API key used for the agent SDK will be configurable. 
  - will support export ANTHROPIC_BASE_URL=
                 export ANTHROPIC_AUTH_TOKEN=
- The application will "crawl" the github repo and build out the file structure including names, etc, and the agent will use that as a guide to know what files it needs to read from the repo, depending on what the goal of the current step is. 

## Functionality
- The goal of this application is to run an AI Agent to build out a Wiki site for a github repo. 
 - This will be a github wiki to start, with more ways to store the wiki coming later.
- The application will start with creating a repo overview Home page on the wiki
- Then, it will document general layout of the application, "architectural slices". 
- Then, in a loop, it will work through each area of the application, and document how it works logically and important information that a developer would need to know. 
 - This process will continue to run and refine these wiki pages over the first N instances of this run, depending on how large the target repo is. 
- Once a baseline wiki is established, this application can also be used in the CI to do automated documentation updates when a PR is created
 - It will look at the git diff and the appropriate wiki information and update it automatically, then commit the changes to the PR. 
- It will also have a "documentation review" mode that will give a pass/fail gate for a PR based on how well it updated the repos documentation in the PR itself, for general review purposes. 


