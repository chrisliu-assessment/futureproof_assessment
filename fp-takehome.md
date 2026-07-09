# FutureProof Software Exercise

## Introduction
This is a short (about 60 minutes) exercise that's designed to showcase your engineering talents -- and your eye for product design -- in this new and somewhat odd world of agentic coding.

Given the limited time frame for the project, we're particularly interested in seeing which features you prioritize, how you get the best quality code from the agent, and in general what your process looks like for doing this kind of work.

Finally, this sort of evaluation is new to us, too. If you find all of the work _around_ the task is adding up to a significant burden, let us know, and we'll adapt it. We're always looking for ways to improve our approach to finding great people.

## Setup
1. Ensure Claude Code is installed on the computer you'll be using. It may be helpful to run this in a VM to keep everything isolated; it'll allow you to avoid a bunch of permissions prompts as well.
    ```shell
    curl -fsSL https://claude.ai/install.sh | bash
    ```
2. Create a new folder for this project
3. Launch Claude Code (run `code` on the command line) and use the paid API key provided. If you're missing the key, get in touch at `info@futureproof.am` and we'll get everything sorted!

## The Task
Build a web page with both a form and a chatbot. We want to collect an address, the square footage, and the building material, a coverage amount ($50k - $500k), and a deductible ($1k-$5k). After entering that information, the user gets presented with a quote for insurance on that property.

Scope this to about an hour of actual project work, excluding setup. This isn't a strict time limit, but should give you a sense of our expectation levels (it's not a magnum opus). Plus, we don't want you to spend a bunch of your own free time doing this. If it's too much work for the time allotted, narrow the scope and we can talk it through. We weight product prioritization and code judgment over feature-completeness.

### Some specs
 - The chatbot is a helper for filling out the form. It should greet the user and work through whatever's missing. Anything already in the form it shouldn't ask for again; anything it collects in conversation should show up in the form once it replies. Form and chatbot share the same state, so either can update it. Roughly, expect the bot to need a way to sync the form, a way to ask for missing info, and a way to generate a quote.
 - Frontend and backend may be in any language you wish to use
 - Building materials are Straw, Wood, Brick, and Steel.
 - Store submitted information, along with the quotes, in a sqlite database
 - Premium calculation follows these rules:
    1. Compute a risk premium: Add $1 per 10 sqft, plus $1 per $1,000 of coverage
    2. Multiply the risk premium by a deductible factor (1.0 at $1k, down to 0.8 at $5k; higher deductible lowers premium)
    3. Then multiply by a material factor (1.0 for Wood, 0.8 for Brick, 0.7 for Steel). Straw is uninsurable and should be rejected.
    4. The quote is a $100 base plus the adjusted risk premium.

The rest is up to you.

## Submission
Once the work is complete:
 1. Stop any dev servers and remove any directories with generated artifacts / binaries / whatever.
 2. Exit Claude Code and copy its project directory (located in `~/.claude/projects/`) into your working directory. Name it `claude-project`. If you're not using a fresh installation of Claude Code, be sure only to copy the directory for this task. This is a complete transcript of your work with the agent.
 3. Compress the folder (.zip or .tgz are fine), ensure the archive filename contains your name, and email to info@futureproof.am.

 Thanks for taking the time to do this. We'll get in touch to schedule a followup conversation shortly!
