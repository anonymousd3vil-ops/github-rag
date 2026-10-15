from git import Repo
import tempfile

temp_dir = tempfile.mkdtemp()

repo = Repo.clone_from(
    "https://github.com/pallets/click.git",
    temp_dir,
    depth=1,
)

print(repo)
print(repo.working_dir)

# Get the current commit
commit = repo.head.commit

print(commit.hexsha)
print(commit.message)