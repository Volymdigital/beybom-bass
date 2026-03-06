# AGENTS.md

## Purpose
This repo is a small, fast-moving project intended to be completed in a few days.
Governance must stay lightweight, but fail-closed.

## Core Rule
Do not start implementing immediately.
Always present a short plan first and wait for owner approval before making code changes.

## Change Modes

### 1. Small change
Use for tiny, low-risk changes.
Examples:
- copy tweaks
- small UI fix
- minor bug fix
- one small component adjustment

Required behavior:
- explain the intended change in 3-6 bullets
- list affected files
- mention any risk briefly
- wait for owner OK before implementation

### 2. Larger change
Use for anything that affects multiple files, logic, data flow, architecture, auth, database, or deployment.

Required behavior:
- define scope
- define out-of-scope
- list affected files/systems
- identify risks
- propose validation steps
- wait for owner OK before implementation

## Hard Stops
Do not, without explicit owner approval:
- modify auth
- modify database schema
- modify deployment/infrastructure
- add or replace dependencies
- refactor unrelated code
- introduce breaking changes
- remove large blocks of code
- change environment variable handling

## Implementation Rules
When approved:
- keep changes minimal
- patch existing code before creating new abstractions
- avoid unnecessary refactors
- preserve current behavior unless change is requested
- state assumptions clearly
- flag uncertainty instead of guessing

## Validation
Before handover:
- confirm what changed
- confirm what was not changed
- confirm how to test
- report known risks or follow-ups

## Default State
STOPP — no implementation before explicit owner approval.
