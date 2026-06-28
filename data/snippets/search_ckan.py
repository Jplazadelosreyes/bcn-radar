import urllib.request
import json
import sys
import ssl

def search_ckan(query):
    url = f"https://opendata-ajuntament.barcelona.cat/data/api/3/action/package_search?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode())
            for pkg in data["result"]["results"]:
                print(f"Dataset: {pkg.get('title', '')}")
                for res in pkg.get("resources", []):
                    if res["format"].lower() == "csv":
                        print(f"  Resource (CSV): {res['name']} - ID: {res['id']}")
                print("-" * 40)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        search_ckan(sys.argv[1])
