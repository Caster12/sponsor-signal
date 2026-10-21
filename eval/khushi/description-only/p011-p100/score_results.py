"""Offline scorer: python3 score_results.py gold.jsonl predictions.jsonl [baseline.jsonl]
Predictions require id,label; confidence is optional. No live API calls.
"""
import json,pathlib,sys,collections
LABELS=['sponsors','does_not_sponsor','silent','unclear']
def read(p):
 rows=[json.loads(x) for x in pathlib.Path(p).read_text().splitlines() if x.strip()];out={}
 for x in rows:
  if x['id'] in out:raise ValueError('Duplicate id: '+x['id'])
  if x.get('label') not in LABELS:raise ValueError('Invalid label: '+str(x))
  out[x['id']]=x
 return out
gold=read(sys.argv[1]);pred=read(sys.argv[2]);eligible={i:x for i,x in gold.items() if x.get('seen_model_output') is False}
missing=sorted(set(eligible)-set(pred));matrix={g:{p:0 for p in LABELS} for g in LABELS};wrong=[];hard=[];buckets=collections.defaultdict(list)
for i,g in eligible.items():
 if i not in pred:continue
 p=pred[i];matrix[g['label']][p['label']]+=1;ok=g['label']==p['label']
 if not ok:wrong.append(i)
 if g['label']=='does_not_sponsor' and p['label']=='sponsors':hard.append(i)
 c=p.get('confidence')
 if isinstance(c,(int,float)) and 0<=c<=100:buckets[str(min(int(c)//10*10,90))+'-'+str(min(int(c)//10*10+9,100) if c<90 else 100)].append((c,ok))
n=len(eligible);correct=sum(matrix[l][l] for l in LABELS);accuracy=correct/n if n else None
report={'eligible':n,'excluded_pilot_or_unspecified':len(gold)-n,'missing_predictions':missing,'correct':correct,'accuracy_missing_counts_as_wrong':accuracy,'accuracy_at_least_85_percent':None if accuracy is None else accuracy>=.85,'hard_rule_violations':hard,'confusion_matrix':matrix,'incorrect_ids':wrong,'confidence_buckets':{k:{'n':len(v),'mean_confidence':sum(x[0] for x in v)/len(v),'accuracy':sum(x[1] for x in v)/len(v)} for k,v in buckets.items()},'complete':not missing}
if len(sys.argv)>3:
 baseline=read(sys.argv[3]);bm=sorted(set(eligible)-set(baseline));ba=sum(baseline.get(i,{}).get('label')==x['label'] for i,x in eligible.items())/n if n else None
 report.update(baseline_accuracy=ba,baseline_missing=bm,beats_baseline=None if ba is None or missing or bm else accuracy>ba)
print(json.dumps(report,indent=2))
