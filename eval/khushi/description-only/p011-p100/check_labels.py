"""Validate an exported label file without making API calls. Usage: python3 check_labels.py labels.jsonl"""
import json,pathlib,sys,collections
root=pathlib.Path(__file__).parent
postings={x['id']:x for x in map(json.loads,(root/'postings.jsonl').read_text().splitlines())}
labels=[json.loads(x) for x in pathlib.Path(sys.argv[1]).read_text().splitlines() if x.strip()]
issues=[];seen=set()
for x in labels:
 i=x.get('id')
 if i not in postings:issues.append(f'{i}: unknown id');continue
 if i in seen:issues.append(f'{i}: duplicate label')
 seen.add(i)
 if x.get('label') not in ['sponsors','does_not_sponsor','silent','unclear']:issues.append(f'{i}: invalid label')
 q=x.get('quote','')
 if x.get('label')=='silent':
  if q!='no sponsorship language found':issues.append(f'{i}: incorrect silent quote')
 elif not q or q not in postings[i]['text_posting']:issues.append(f'{i}: quote is missing or not verbatim')
 if not isinstance(x.get('seen_model_output'),bool):issues.append(f'{i}: seen_model_output must be boolean')
print(json.dumps({'completed':len(seen),'target':90,'pending_ids':sorted(set(postings)-seen),'pilot_ids':[x['id'] for x in labels if x.get('seen_model_output') is True],'issues':issues},indent=2))
sys.exit(bool(issues))
