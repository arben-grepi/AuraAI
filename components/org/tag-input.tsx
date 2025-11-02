"use client";
import {
  Tags,
  TagsContent,
  TagsEmpty,
  TagsGroup,
  TagsInput,
  TagsItem,
  TagsList,
  TagsTrigger,
  TagsValue,
} from "@/components/ui/shadcn-io/tags";
import { CheckIcon, PlusIcon, Tag } from "lucide-react";
import { useState, Dispatch, SetStateAction } from "react";
const defaultTags = [
  { id: "legal", label: "Legal" },
  { id: "financial", label: "Financial" },
  { id: "marketing", label: "Marketing" },
  { id: "sales", label: "Sales" },
  { id: "customer-support", label: "Customer Support" },
  { id: "product", label: "Product" },
  { id: "other", label: "Other" },
];
const TagInput = ({
  selected,
  setSelected,
}: {
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
}) => {
  const [newTag, setNewTag] = useState<string>("");
  const [tags, setTags] =
    useState<{ id: string; label: string }[]>(defaultTags);
  const handleRemove = (value: string) => {
    if (!selected?.includes(value)) {
      return;
    }
    console.log(`removed: ${value}`);
    setSelected((prev: string[]) => prev.filter((v: string) => v !== value));
  };
  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      handleRemove(value);
      return;
    }
    console.log(`selected: ${value}`);
    setSelected((prev) => [...prev, value]);
  };
  const handleCreateTag = () => {
    console.log(`created: ${newTag}`);
    setTags((prev) => [
      ...prev,
      {
        id: newTag,
        label: newTag,
      },
    ]);
    setSelected((prev) => [...prev, newTag]);
    setNewTag("");
  };
  return (
    <Tags className="">
      <TagsTrigger>
        <Tag className="mr-2 ml-2" />
        {selected.map((tag) => (
          <TagsValue
            className="bg-transparent text-black border-zinc-200 py-2"
            key={tag}
            onRemove={() => handleRemove(tag)}
          >
            {tags.find((t) => t.id === tag)?.label}
          </TagsValue>
        ))}
      </TagsTrigger>
      <TagsContent className="w-full">
        <TagsInput onValueChange={setNewTag} placeholder="Search tag..." />
        <TagsList>
          <TagsEmpty>
            <button
              className="mx-auto flex cursor-pointer items-center gap-2"
              onClick={handleCreateTag}
              type="button"
            >
              <PlusIcon className="text-muted-foreground" size={14} />
              Create new tag: {newTag}
            </button>
          </TagsEmpty>
          <TagsGroup>
            {tags.map((tag) => (
              <TagsItem key={tag.id} onSelect={handleSelect} value={tag.id}>
                {tag.label}
                {selected.includes(tag.id) && (
                  <CheckIcon className="text-muted-foreground" size={14} />
                )}
              </TagsItem>
            ))}
          </TagsGroup>
        </TagsList>
      </TagsContent>
    </Tags>
  );
};
export default TagInput;
